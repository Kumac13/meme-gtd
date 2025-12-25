import UIKit
import WebKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    private var webView: WKWebView!
    private var statusLabel: UILabel!
    private var activityIndicator: UIActivityIndicatorView!
    private var containerView: UIView!

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        extractAndSave()
    }

    private func setupUI() {
        view.backgroundColor = UIColor(red: 249/255, green: 250/255, blue: 251/255, alpha: 1) // gray-50

        // Container for status UI
        containerView = UIView()
        containerView.backgroundColor = .white
        containerView.layer.cornerRadius = 12
        containerView.layer.shadowColor = UIColor.black.cgColor
        containerView.layer.shadowOpacity = 0.1
        containerView.layer.shadowRadius = 10
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)

        // Activity indicator
        activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.color = UIColor(red: 45/255, green: 164/255, blue: 78/255, alpha: 1) // accent
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(activityIndicator)

        // Status label
        statusLabel = UILabel()
        statusLabel.text = "Saving article..."
        statusLabel.textAlignment = .center
        statusLabel.font = .systemFont(ofSize: 16, weight: .medium)
        statusLabel.textColor = UIColor(red: 17/255, green: 24/255, blue: 39/255, alpha: 1) // textPrimary
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(statusLabel)

        // Hidden WebView for extraction
        let configuration = WKWebViewConfiguration()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.isHidden = true
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            containerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.widthAnchor.constraint(equalToConstant: 280),
            containerView.heightAnchor.constraint(equalToConstant: 120),

            activityIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            activityIndicator.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 24),

            statusLabel.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            statusLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16)
        ])

        activityIndicator.startAnimating()
    }

    private func extractAndSave() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let itemProvider = extensionItem.attachments?.first else {
            showError("No content to share")
            return
        }

        // Try to get URL
        if itemProvider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            itemProvider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, error in
                if let error = error {
                    self?.showError("Failed to load URL: \(error.localizedDescription)")
                    return
                }

                guard let url = item as? URL else {
                    self?.showError("Invalid URL")
                    return
                }

                DispatchQueue.main.async {
                    self?.loadAndExtract(url: url)
                }
            }
        } else {
            showError("No URL found in shared content")
        }
    }

    private func loadAndExtract(url: URL) {
        updateStatus("Loading page...")
        webView.load(URLRequest(url: url))
    }

    private func executeExtraction() {
        updateStatus("Extracting article...")

        // Load the bundled JavaScript
        guard let jsPath = Bundle.main.path(forResource: "extractor.bundle", ofType: "js"),
              let jsCode = try? String(contentsOfFile: jsPath, encoding: .utf8) else {
            showError("Failed to load extractor")
            return
        }

        // Execute the extraction script
        let script = """
        \(jsCode)
        (async function() {
            try {
                const result = await window.MemeGTDExtractor.extractArticle();
                return result;
            } catch (e) {
                return JSON.stringify({ error: e.message || String(e) });
            }
        })();
        """

        webView.evaluateJavaScript(script) { [weak self] result, error in
            if let error = error {
                self?.showError("Extraction failed: \(error.localizedDescription)")
                return
            }

            guard let jsonString = result as? String,
                  let data = jsonString.data(using: .utf8) else {
                self?.showError("Invalid extraction result")
                return
            }

            do {
                let article = try JSONDecoder().decode(ExtractedArticle.self, from: data)

                if let errorMsg = article.error {
                    self?.showError("Extraction error: \(errorMsg)")
                    return
                }

                self?.saveToAPI(article: article)
            } catch {
                self?.showError("Failed to parse article: \(error.localizedDescription)")
            }
        }
    }

    private func saveToAPI(article: ExtractedArticle) {
        updateStatus("Saving to server...")

        let request = CreateArticleRequest(
            title: article.title,
            bodyMd: article.content,
            originalUrl: article.originalUrl,
            siteName: article.siteName
        )

        Task {
            do {
                _ = try await APIClient.shared.saveArticle(request)
                await MainActor.run {
                    showSuccess("Article saved!")
                }
            } catch {
                await MainActor.run {
                    showError(error.localizedDescription)
                }
            }
        }
    }

    private func updateStatus(_ message: String) {
        DispatchQueue.main.async {
            self.statusLabel.text = message
        }
    }

    private func showSuccess(_ message: String) {
        activityIndicator.stopAnimating()
        statusLabel.text = message
        statusLabel.textColor = UIColor(red: 45/255, green: 164/255, blue: 78/255, alpha: 1) // accent

        // Add checkmark
        let checkmark = UIImageView(image: UIImage(systemName: "checkmark.circle.fill"))
        checkmark.tintColor = UIColor(red: 45/255, green: 164/255, blue: 78/255, alpha: 1)
        checkmark.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(checkmark)

        NSLayoutConstraint.activate([
            checkmark.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            checkmark.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 24),
            checkmark.widthAnchor.constraint(equalToConstant: 40),
            checkmark.heightAnchor.constraint(equalToConstant: 40)
        ])

        // Dismiss after delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }

    private func showError(_ message: String) {
        DispatchQueue.main.async {
            self.activityIndicator.stopAnimating()
            self.statusLabel.text = message
            self.statusLabel.textColor = .systemRed

            // Add error icon
            let errorIcon = UIImageView(image: UIImage(systemName: "xmark.circle.fill"))
            errorIcon.tintColor = .systemRed
            errorIcon.translatesAutoresizingMaskIntoConstraints = false
            self.containerView.addSubview(errorIcon)

            NSLayoutConstraint.activate([
                errorIcon.centerXAnchor.constraint(equalTo: self.containerView.centerXAnchor),
                errorIcon.topAnchor.constraint(equalTo: self.containerView.topAnchor, constant: 24),
                errorIcon.widthAnchor.constraint(equalToConstant: 40),
                errorIcon.heightAnchor.constraint(equalToConstant: 40)
            ])

            // Dismiss after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                self.extensionContext?.cancelRequest(withError: NSError(domain: "MemeGTD", code: 1, userInfo: [NSLocalizedDescriptionKey: message]))
            }
        }
    }
}

// MARK: - WKNavigationDelegate
extension ShareViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        executeExtraction()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showError("Failed to load page: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showError("Failed to load page: \(error.localizedDescription)")
    }
}
