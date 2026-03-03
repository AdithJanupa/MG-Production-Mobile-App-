import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'printing/bill_printer_service_stub.dart'
    if (dart.library.io) 'printing/bill_printer_service_io.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    await InAppWebViewController.setWebContentsDebuggingEnabled(kDebugMode);
  }

  runApp(const MGProductsApp());
}

class MGProductsApp extends StatelessWidget {
  const MGProductsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MG PRODUCTS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
      ),
      home: const MGProductsHomePage(),
    );
  }
}

class MGProductsHomePage extends StatefulWidget {
  const MGProductsHomePage({super.key});

  @override
  State<MGProductsHomePage> createState() => _MGProductsHomePageState();
}

class _MGProductsHomePageState extends State<MGProductsHomePage> {
  final InAppLocalhostServer _localhostServer = InAppLocalhostServer(
    documentRoot: 'assets/webapp',
  );
  InAppWebViewController? _webViewController;
  late final BillPrinterService _billPrinterService;

  bool _serverReady = false;
  String? _startupError;
  double _loadingProgress = 0;

  WebUri get _initialUri {
    if (kIsWeb) {
      return WebUri.uri(Uri.base.resolve('assets/webapp/index.html'));
    }
    return WebUri('http://localhost:8080/index.html');
  }

  @override
  void initState() {
    super.initState();
    _billPrinterService = BillPrinterService();
    unawaited(_initializeBillPrinterService());

    if (kIsWeb) {
      _serverReady = true;
      return;
    }
    _startLocalServer();
  }

  @override
  void dispose() {
    if (!kIsWeb && _localhostServer.isRunning()) {
      unawaited(_localhostServer.close());
    }
    super.dispose();
  }

  Future<void> _startLocalServer() async {
    try {
      if (!_localhostServer.isRunning()) {
        await _localhostServer.start();
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _serverReady = true;
        _startupError = null;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _startupError = error.toString();
      });
    }
  }

  Future<void> _handleBack() async {
    final controller = _webViewController;
    if (controller != null && await controller.canGoBack()) {
      await controller.goBack();
      return;
    }

    await SystemNavigator.pop();
  }

  Future<void> _initializeBillPrinterService() async {
    await _billPrinterService.initialize();
    if (!mounted) {
      return;
    }
    setState(() {});
  }

  Map<String, dynamic> _normalizeOrderPayload(dynamic payload) {
    if (payload is Map) {
      return payload.map((key, value) => MapEntry(key.toString(), value));
    }
    return <String, dynamic>{};
  }

  Future<PrinterDevice?> _showPrinterPicker(List<PrinterDevice> devices) async {
    if (!mounted || devices.isEmpty) {
      return null;
    }

    return showDialog<PrinterDevice>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Select Bluetooth Printer'),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: devices.length,
              itemBuilder: (itemContext, index) {
                final device = devices[index];
                final title = device.name.isEmpty
                    ? device.macAddress
                    : device.name;
                return ListTile(
                  title: Text(title),
                  subtitle: Text(device.macAddress),
                  onTap: () => Navigator.of(dialogContext).pop(device),
                );
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
          ],
        );
      },
    );
  }

  void _showSnackMessage(String message, {bool isError = false}) {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : null,
      ),
    );
  }

  Future<void> _openPrinterSetup() async {
    final discovery = await _billPrinterService.discoverPrinters();
    if (!discovery.success) {
      _showSnackMessage(discovery.message, isError: true);
      return;
    }

    final selected = await _showPrinterPicker(discovery.devices);
    if (selected == null) {
      return;
    }

    final result = await _billPrinterService.connectAndRemember(selected);
    _showSnackMessage(result.message, isError: !result.success);
    if (mounted) {
      setState(() {});
    }
  }

  Future<Map<String, dynamic>> _handlePrintBillFromWeb(
    List<dynamic> args,
  ) async {
    final payload = args.isNotEmpty ? args.first : null;
    final order = _normalizeOrderPayload(payload);

    final result = await _billPrinterService.printOrderBill(
      order: order,
      onSelectPrinter: _showPrinterPicker,
    );

    _showSnackMessage(result.message, isError: !result.success);
    if (mounted) {
      setState(() {});
    }

    return <String, dynamic>{
      'success': result.success,
      'message': result.message,
    };
  }

  @override
  Widget build(BuildContext context) {
    if (_startupError != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 56, color: Colors.red),
                const SizedBox(height: 16),
                const Text(
                  'Failed to start app server',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text(
                  _startupError!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.black54),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _startLocalServer,
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (!_serverReady) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 12),
              Text('Starting MG PRODUCTS app...'),
            ],
          ),
        ),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          _handleBack();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('MG PRODUCTS'),
          actions: [
            IconButton(
              tooltip: _billPrinterService.selectedPrinterName == null
                  ? 'Setup Bluetooth Printer'
                  : 'Printer: ${_billPrinterService.selectedPrinterName}',
              onPressed: _openPrinterSetup,
              icon: Icon(
                _billPrinterService.selectedPrinterName == null
                    ? Icons.print_outlined
                    : Icons.print,
              ),
            ),
            IconButton(
              tooltip: 'Reload',
              onPressed: () => _webViewController?.reload(),
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: Stack(
          children: [
            InAppWebView(
              initialUrlRequest: URLRequest(url: _initialUri),

              initialSettings: InAppWebViewSettings(
                javaScriptEnabled: true,
                mediaPlaybackRequiresUserGesture: false,
                supportZoom: false,
              ),
              onWebViewCreated: (controller) {
                _webViewController = controller;
                controller.addJavaScriptHandler(
                  handlerName: 'printBill',
                  callback: _handlePrintBillFromWeb,
                );
              },
              onProgressChanged: (controller, progress) {
                if (!mounted) {
                  return;
                }

                setState(() {
                  _loadingProgress = progress / 100;
                });
              },
              onReceivedError: (controller, request, error) {
                if (!mounted) {
                  return;
                }

                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(SnackBar(content: Text(error.description)));
              },
            ),
            if (_loadingProgress < 1)
              LinearProgressIndicator(
                value: _loadingProgress == 0 ? null : _loadingProgress,
                minHeight: 2,
              ),
          ],
        ),
      ),
    );
  }
}
