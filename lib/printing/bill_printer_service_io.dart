import 'dart:async';

import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:permission_handler/permission_handler.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PrinterDevice {
  const PrinterDevice({required this.name, required this.macAddress});

  final String name;
  final String macAddress;
}

class PrinterDiscoveryResult {
  const PrinterDiscoveryResult({
    required this.success,
    required this.message,
    this.devices = const <PrinterDevice>[],
  });

  final bool success;
  final String message;
  final List<PrinterDevice> devices;
}

class BillPrintResult {
  const BillPrintResult({required this.success, required this.message});

  final bool success;
  final String message;
}

class BillPrinterService {
  static const String _printerMacKey = 'printer.mac_address';
  static const String _printerNameKey = 'printer.name';
  static final Future<CapabilityProfile> _capabilityProfileFuture =
      CapabilityProfile.load();
  static const int _logoPrintWidth = 140;

  String? _selectedPrinterName;
  String? _selectedPrinterMacAddress;
  img.Image? _cachedResizedLogoImage;
  bool _logoLoadAttempted = false;

  String? get selectedPrinterName => _selectedPrinterName;

  String? get selectedPrinterMacAddress => _selectedPrinterMacAddress;

  bool get _isAndroid => defaultTargetPlatform == TargetPlatform.android;

  Future<void> initialize() async {
    if (!_isAndroid) {
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    _selectedPrinterName = prefs.getString(_printerNameKey);
    _selectedPrinterMacAddress = prefs.getString(_printerMacKey);
  }

  Future<PrinterDiscoveryResult> discoverPrinters() async {
    if (!_isAndroid) {
      return const PrinterDiscoveryResult(
        success: false,
        message: 'Bluetooth bill printing is supported only on Android.',
      );
    }

    final permissionGranted = await _ensureBluetoothPermission();
    if (!permissionGranted) {
      return const PrinterDiscoveryResult(
        success: false,
        message: 'Bluetooth permission denied. Please allow Bluetooth access.',
      );
    }

    final bluetoothOn = await PrintBluetoothThermal.bluetoothEnabled;
    if (!bluetoothOn) {
      return const PrinterDiscoveryResult(
        success: false,
        message: 'Bluetooth is off. Turn on Bluetooth and try again.',
      );
    }

    final paired = await PrintBluetoothThermal.pairedBluetooths;
    final devices =
        paired
            .map(
              (item) => PrinterDevice(
                name: item.name.trim(),
                macAddress: item.macAdress.trim(),
              ),
            )
            .where((item) => item.macAddress.isNotEmpty)
            .toList()
          ..sort(
            (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
          );

    if (devices.isEmpty) {
      return const PrinterDiscoveryResult(
        success: false,
        message:
            'No paired Bluetooth printers found. Pair your PT-210 in phone Bluetooth settings first.',
      );
    }

    return PrinterDiscoveryResult(
      success: true,
      message: 'Found ${devices.length} paired Bluetooth device(s).',
      devices: devices,
    );
  }

  Future<BillPrintResult> connectAndRemember(PrinterDevice device) async {
    if (!_isAndroid) {
      return const BillPrintResult(
        success: false,
        message: 'Bluetooth bill printing is supported only on Android.',
      );
    }

    final alreadyConnected = await PrintBluetoothThermal.connectionStatus;
    if (alreadyConnected) {
      await PrintBluetoothThermal.disconnect;
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }

    final connected = await PrintBluetoothThermal.connect(
      macPrinterAddress: device.macAddress,
    );

    if (!connected) {
      return BillPrintResult(
        success: false,
        message:
            'Failed to connect to printer ${device.name.isEmpty ? device.macAddress : device.name}.',
      );
    }

    _selectedPrinterName = device.name;
    _selectedPrinterMacAddress = device.macAddress;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_printerNameKey, _selectedPrinterName ?? '');
    await prefs.setString(_printerMacKey, _selectedPrinterMacAddress ?? '');

    return BillPrintResult(
      success: true,
      message:
          'Connected to ${device.name.isEmpty ? device.macAddress : device.name}.',
    );
  }

  Future<BillPrintResult> printOrderBill({
    required Map<String, dynamic> order,
    required Future<PrinterDevice?> Function(List<PrinterDevice> devices)
    onSelectPrinter,
  }) async {
    if (!_isAndroid) {
      return const BillPrintResult(
        success: false,
        message: 'Bill printing is available only on Android mobile.',
      );
    }

    final ready = await _ensurePrinterConnection(onSelectPrinter);
    if (!ready.success) {
      return ready;
    }

    try {
      final bytes = await _buildOrderBillBytes(order);
      var printed = await PrintBluetoothThermal.writeBytes(bytes);

      if (!printed) {
        final retryReady = await _ensurePrinterConnection(
          onSelectPrinter,
          forceReconnect: true,
        );
        if (!retryReady.success) {
          return BillPrintResult(success: false, message: retryReady.message);
        }

        printed = await PrintBluetoothThermal.writeBytes(bytes);
      }

      if (!printed) {
        return const BillPrintResult(
          success: false,
          message: 'Unable to send bill to printer. Please reconnect printer.',
        );
      }

      return const BillPrintResult(
        success: true,
        message: 'Bill printed successfully.',
      );
    } catch (_) {
      return const BillPrintResult(
        success: false,
        message: 'Printing failed while preparing the bill.',
      );
    }
  }

  Future<BillPrintResult> _ensurePrinterConnection(
    Future<PrinterDevice?> Function(List<PrinterDevice> devices)
    onSelectPrinter, {
    bool forceReconnect = false,
  }) async {
    final permissionGranted = await _ensureBluetoothPermission();
    if (!permissionGranted) {
      return const BillPrintResult(
        success: false,
        message: 'Bluetooth permission denied. Please allow Bluetooth access.',
      );
    }

    final bluetoothOn = await PrintBluetoothThermal.bluetoothEnabled;
    if (!bluetoothOn) {
      return const BillPrintResult(
        success: false,
        message: 'Bluetooth is off. Turn on Bluetooth and try again.',
      );
    }

    if (!forceReconnect) {
      final alreadyConnected = await PrintBluetoothThermal.connectionStatus;
      if (alreadyConnected) {
        return const BillPrintResult(success: true, message: 'Printer ready.');
      }
    } else {
      await PrintBluetoothThermal.disconnect;
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }

    if (_selectedPrinterMacAddress != null &&
        _selectedPrinterMacAddress!.trim().isNotEmpty) {
      var connected = await PrintBluetoothThermal.connect(
        macPrinterAddress: _selectedPrinterMacAddress!,
      );

      if (!connected) {
        await PrintBluetoothThermal.disconnect;
        await Future<void>.delayed(const Duration(milliseconds: 250));
        connected = await PrintBluetoothThermal.connect(
          macPrinterAddress: _selectedPrinterMacAddress!,
        );
      }

      if (connected) {
        return const BillPrintResult(success: true, message: 'Printer ready.');
      }
    }

    final discovery = await discoverPrinters();
    if (!discovery.success) {
      return BillPrintResult(success: false, message: discovery.message);
    }

    final selected = await onSelectPrinter(discovery.devices);
    if (selected == null) {
      return const BillPrintResult(
        success: false,
        message: 'Bill printing cancelled. No printer selected.',
      );
    }

    return connectAndRemember(selected);
  }

  Future<bool> _ensureBluetoothPermission() async {
    if (!_isAndroid) {
      return false;
    }

    final pluginPermission =
        await PrintBluetoothThermal.isPermissionBluetoothGranted;
    if (pluginPermission) {
      return true;
    }

    final statuses = await <Permission>[
      Permission.bluetoothConnect,
      Permission.bluetoothScan,
    ].request();

    final connectGranted =
        statuses[Permission.bluetoothConnect]?.isGranted ??
        statuses[Permission.bluetoothConnect]?.isLimited == true;
    final scanGranted =
        statuses[Permission.bluetoothScan]?.isGranted ??
        statuses[Permission.bluetoothScan]?.isLimited == true;

    if (!connectGranted || !scanGranted) {
      return false;
    }

    return PrintBluetoothThermal.isPermissionBluetoothGranted;
  }

  Future<List<int>> _buildOrderBillBytes(Map<String, dynamic> order) async {
    final profile = await _capabilityProfileFuture;
    final generator = Generator(PaperSize.mm58, profile);
    final bytes = <int>[];

    bytes.addAll(generator.reset());
    final logoImage = await _loadLogoImage();
    if (logoImage != null) {
      bytes.addAll(generator.imageRaster(logoImage, align: PosAlign.center));
    }

    final now = DateTime.now();
    final billNumber = _stringValue(order['billNumber']);
    final orderDate = _stringValue(order['date']);
    final orderId = _stringValue(order['id']);
    final shopName = _stringValue(order['shopName']);
    final productName = _stringValue(order['product']);
    final quantity = _intValue(order['quantity']);
    final rate = _doubleValue(order['rate']);
    final total = _doubleValue(order['total']);
    final paymentStatus = _stringValue(order['paymentStatus']).toLowerCase();
    final paidDate = _stringValue(order['paidDate']);
    final note = _stringValue(order['note']);

    bytes.addAll(
      generator.text(
        'MG PRODUCTS',
        styles: const PosStyles(
          align: PosAlign.center,
          bold: true,
          height: PosTextSize.size2,
          width: PosTextSize.size2,
        ),
      ),
    );

    bytes.addAll(
      generator.text(
        'SALES BILL',
        styles: const PosStyles(align: PosAlign.center, bold: true),
      ),
    );

    bytes.addAll(generator.text('Printed : ${_formatDateTime(now)}'));
    bytes.addAll(generator.hr());

    bytes.addAll(
      generator.text('Bill No : ${billNumber.isEmpty ? '-' : billNumber}'),
    );
    bytes.addAll(
      generator.text('Order ID: ${orderId.isEmpty ? '-' : orderId}'),
    );
    bytes.addAll(
      generator.text(
        'Date    : ${orderDate.isEmpty ? _formatDate(now) : orderDate}',
      ),
    );
    bytes.addAll(
      generator.text('Shop    : ${shopName.isEmpty ? '-' : shopName}'),
    );

    bytes.addAll(generator.hr());

    bytes.addAll(
      generator.row([
        PosColumn(text: 'Item', width: 6, styles: const PosStyles(bold: true)),
        PosColumn(
          text: 'Qty',
          width: 2,
          styles: const PosStyles(align: PosAlign.right, bold: true),
        ),
        PosColumn(
          text: 'Rate',
          width: 2,
          styles: const PosStyles(align: PosAlign.right, bold: true),
        ),
        PosColumn(
          text: 'Amt',
          width: 2,
          styles: const PosStyles(align: PosAlign.right, bold: true),
        ),
      ]),
    );

    bytes.addAll(
      generator.row([
        PosColumn(
          text: productName.isEmpty ? '-' : productName,
          width: 6,
          styles: const PosStyles(),
        ),
        PosColumn(
          text: '$quantity',
          width: 2,
          styles: const PosStyles(align: PosAlign.right),
        ),
        PosColumn(
          text: rate.toStringAsFixed(0),
          width: 2,
          styles: const PosStyles(align: PosAlign.right),
        ),
        PosColumn(
          text: total.toStringAsFixed(0),
          width: 2,
          styles: const PosStyles(align: PosAlign.right),
        ),
      ]),
    );

    bytes.addAll(generator.hr());

    bytes.addAll(
      generator.row([
        PosColumn(text: 'TOTAL', width: 8, styles: const PosStyles(bold: true)),
        PosColumn(
          text: 'Rs ${total.toStringAsFixed(2)}',
          width: 4,
          styles: const PosStyles(align: PosAlign.right, bold: true),
        ),
      ]),
    );

    bytes.addAll(
      generator.text(
        'Payment : ${paymentStatus == 'paid' ? 'Paid' : 'Non-Paid'}',
      ),
    );

    if (paidDate.isNotEmpty) {
      bytes.addAll(generator.text('Paid Dt : $paidDate'));
    }

    if (note.isNotEmpty) {
      bytes.addAll(generator.hr());
      bytes.addAll(generator.text('Note: $note'));
    }

    bytes.addAll(generator.feed(1));
    bytes.addAll(
      generator.text(
        'Thank you for your order!',
        styles: const PosStyles(align: PosAlign.center, bold: true),
      ),
    );
    bytes.addAll(generator.feed(3));

    return bytes;
  }

  Future<img.Image?> _loadLogoImage() async {
    if (_cachedResizedLogoImage != null) {
      return _cachedResizedLogoImage;
    }

    if (_logoLoadAttempted) {
      return null;
    }

    _logoLoadAttempted = true;

    try {
      final data = await rootBundle.load('assets/webapp/icons/logo.png');
      final bytes = data.buffer.asUint8List();
      final decoded = img.decodeImage(bytes);
      if (decoded == null) {
        return null;
      }

      _cachedResizedLogoImage = img.copyResize(decoded, width: _logoPrintWidth);
      return _cachedResizedLogoImage;
    } catch (_) {
      return null;
    }
  }

  String _stringValue(dynamic value) {
    if (value == null) {
      return '';
    }
    return value.toString().trim();
  }

  int _intValue(dynamic value) {
    if (value is int) {
      return value;
    }
    if (value is double) {
      return value.round();
    }
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  double _doubleValue(dynamic value) {
    if (value is double) {
      return value;
    }
    if (value is int) {
      return value.toDouble();
    }
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.year}-${_twoDigits(dateTime.month)}-${_twoDigits(dateTime.day)} '
        '${_twoDigits(dateTime.hour)}:${_twoDigits(dateTime.minute)}:${_twoDigits(dateTime.second)}';
  }

  String _formatDate(DateTime dateTime) {
    return '${dateTime.year}-${_twoDigits(dateTime.month)}-${_twoDigits(dateTime.day)}';
  }

  String _twoDigits(int value) {
    return value.toString().padLeft(2, '0');
  }
}
