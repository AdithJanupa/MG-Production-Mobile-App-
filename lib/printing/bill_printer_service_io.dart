import 'dart:async';

import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:flutter/foundation.dart';
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
  static const String _shopContactNumber = '077 917 0476';

  String? _selectedPrinterName;
  String? _selectedPrinterMacAddress;

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
    } catch (error, stackTrace) {
      debugPrint('Bill printing failed: $error\n$stackTrace');
      return BillPrintResult(
        success: false,
        message: _friendlyPrintError(error),
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

    final now = DateTime.now();
    final billNumber = _safePrintText(_stringValue(order['billNumber']));
    final orderDate = _safePrintText(_stringValue(order['date']));
    final shopName = _safePrintText(_stringValue(order['shopName']));
    final productName = _safePrintText(_stringValue(order['product']));
    final quantity = _intValue(order['quantity']);
    final rate = _doubleValue(order['rate']);
    final total = _doubleValue(order['total']);
    final paymentStatus = _safePrintText(
      _stringValue(order['paymentStatus']),
    ).toLowerCase();
    final paidDate = _safePrintText(_stringValue(order['paidDate']));
    final note = _safePrintText(_stringValue(order['note']));

    final safeBillNumber = billNumber.isEmpty ? '-' : billNumber;
    final safeOrderDate = orderDate.isEmpty ? _formatDate(now) : orderDate;
    final safeShopName = shopName.isEmpty ? '-' : shopName;
    final safeProductName = productName.isEmpty ? '-' : productName;
    final isPaid = paymentStatus == 'paid';

    final parsedItems = _extractOrderItems(order);
    final effectiveItems = parsedItems.isNotEmpty
        ? parsedItems
        : <Map<String, dynamic>>[
            <String, dynamic>{
              'product': safeProductName,
              'quantity': quantity > 0 ? quantity : 1,
              'rate': rate,
              'lineTotal': total > 0
                  ? total
                  : (quantity > 0 ? quantity * rate : 0),
            },
          ];

    final computedTotal = effectiveItems.fold<double>(0, (sum, item) {
      return sum + _doubleValue(item['lineTotal']);
    });
    final grandTotal = total > 0 ? total : computedTotal;

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
        'PREMIUM SALES BILL',
        styles: const PosStyles(align: PosAlign.center, bold: true),
      ),
    );
    bytes.addAll(
      generator.text(
        'Printed: ${_formatDateTime(now)}',
        styles: const PosStyles(),
      ),
    );
    bytes.addAll(
      generator.text(safeShopName, styles: const PosStyles(bold: true)),
    );
    bytes.addAll(generator.feed(1));

    bytes.addAll(
      generator.text(
        'Bill No : $safeBillNumber',
        styles: const PosStyles(bold: true),
      ),
    );
    bytes.addAll(generator.text('Date    : $safeOrderDate'));

    bytes.addAll(generator.hr());
    bytes.addAll(
      generator.text(
        'ITEM DETAILS',
        styles: const PosStyles(align: PosAlign.center, bold: true),
      ),
    );

    for (final item in effectiveItems) {
      final itemName = _safePrintText(_stringValue(item['product']));
      final itemQty = _intValue(item['quantity']);
      final itemRate = _doubleValue(item['rate']);
      final itemTotal = _doubleValue(item['lineTotal']);

      bytes.addAll(
        generator.text(
          itemName.isEmpty ? '-' : itemName,
          styles: const PosStyles(bold: true),
        ),
      );
      bytes.addAll(
        generator.text(
          '  Qty: $itemQty  Rate: Rs ${itemRate.toStringAsFixed(2)}',
        ),
      );
      bytes.addAll(
        generator.text('  Amount: Rs ${itemTotal.toStringAsFixed(2)}'),
      );
    }

    bytes.addAll(generator.hr());
    bytes.addAll(
      generator.text(
        'TOTAL   : Rs ${grandTotal.toStringAsFixed(2)}',
        styles: const PosStyles(bold: true, height: PosTextSize.size2),
      ),
    );

    bytes.addAll(
      generator.text(
        isPaid ? 'Payment : PAID' : 'Payment : NON-PAID',
        styles: const PosStyles(bold: true),
      ),
    );

    if (paidDate.isNotEmpty) {
      bytes.addAll(generator.text('Paid Dt : $paidDate'));
    }

    if (note.isNotEmpty) {
      bytes.addAll(generator.hr());
      bytes.addAll(generator.text('Note: $note'));
    }

    bytes.addAll(generator.hr());
    bytes.addAll(
      generator.text(
        'Thank you for shopping with us!',
        styles: const PosStyles(align: PosAlign.center, bold: true),
      ),
    );
    bytes.addAll(
      generator.text(
        'Contact: $_shopContactNumber',
        styles: const PosStyles(align: PosAlign.center),
      ),
    );
    bytes.addAll(generator.feed(3));

    return bytes;
  }

  List<Map<String, dynamic>> _extractOrderItems(Map<String, dynamic> order) {
    final rawItems = order['items'];
    if (rawItems is! List) {
      return const <Map<String, dynamic>>[];
    }

    final parsed = <Map<String, dynamic>>[];
    for (final rawItem in rawItems) {
      if (rawItem is! Map) {
        continue;
      }

      final item = rawItem.map((key, value) => MapEntry(key.toString(), value));
      final product = _safePrintText(_stringValue(item['product']));
      final quantity = _intValue(item['quantity']);
      final rate = _doubleValue(item['rate']);
      final lineTotal = _doubleValue(item['lineTotal']);

      if (product.isEmpty || quantity <= 0 || rate <= 0) {
        continue;
      }

      parsed.add(<String, dynamic>{
        'product': product,
        'quantity': quantity,
        'rate': rate,
        'lineTotal': lineTotal > 0 ? lineTotal : quantity * rate,
      });
    }

    return parsed;
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
      if (!value.isFinite) {
        return 0;
      }
      return value.round();
    }
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  double _doubleValue(dynamic value) {
    if (value is double) {
      return value.isFinite ? value : 0;
    }
    if (value is int) {
      return value.toDouble();
    }
    final parsed = double.tryParse(value?.toString() ?? '');
    if (parsed == null || !parsed.isFinite) {
      return 0;
    }
    return parsed;
  }

  String _safePrintText(String value) {
    if (value.isEmpty) {
      return value;
    }

    final sanitized = value.runes
        .map((rune) {
          if (rune == 10 || rune == 13 || rune == 9) {
            return 32;
          }

          // ASCII printable + Latin-1 range supported by current encoder.
          if ((rune >= 32 && rune <= 126) || (rune >= 160 && rune <= 255)) {
            return rune;
          }
          return 63; // '?'
        })
        .toList(growable: false);

    return String.fromCharCodes(sanitized).trim();
  }

  String _friendlyPrintError(Object error) {
    final message = error.toString();
    final lower = message.toLowerCase();

    if (lower.contains('latin') || lower.contains('codec')) {
      return 'Bill has unsupported characters. Please use English letters, numbers, and symbols only.';
    }

    if (lower.contains('column') || lower.contains('width')) {
      return 'Bill layout error while preparing print data.';
    }

    return 'Printing failed while preparing the bill. $message';
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
