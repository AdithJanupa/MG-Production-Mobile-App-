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
  String? get selectedPrinterName => null;

  String? get selectedPrinterMacAddress => null;

  Future<void> initialize() async {}

  Future<PrinterDiscoveryResult> discoverPrinters() async {
    return const PrinterDiscoveryResult(
      success: false,
      message: 'Bluetooth bill printing is only available on Android mobile.',
    );
  }

  Future<BillPrintResult> connectAndRemember(PrinterDevice device) async {
    return const BillPrintResult(
      success: false,
      message: 'Bluetooth bill printing is only available on Android mobile.',
    );
  }

  Future<BillPrintResult> printOrderBill({
    required Map<String, dynamic> order,
    required Future<PrinterDevice?> Function(List<PrinterDevice> devices)
    onSelectPrinter,
  }) async {
    return const BillPrintResult(
      success: false,
      message: 'Bluetooth bill printing is only available on Android mobile.',
    );
  }
}
