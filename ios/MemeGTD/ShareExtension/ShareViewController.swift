import UIKit
import WebKit
import UniformTypeIdentifiers
import GRDB

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
        view.backgroundColor = UIColor.black.withAlphaComponent(0.4)

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
        activityIndicator.color = UIColor(red: 45/255, green: 164/255, blue: 78/255, alpha: 1)
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(activityIndicator)

        // Status label
        statusLabel = UILabel()
        statusLabel.text = "Saving article..."
        statusLabel.textAlignment = .center
        statusLabel.font = .systemFont(ofSize: 16, weight: .medium)
        statusLabel.textColor = UIColor(red: 17/255, green: 24/255, blue: 39/255, alpha: 1)
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

        Task {
            do {
                let url = try await loadURL(from: itemProvider)
                await MainActor.run {
                    self.loadAndExtract(url: url)
                }
            } catch {
                await MainActor.run {
                    self.showError("Failed to load URL: \(error.localizedDescription)")
                }
            }
        }
    }

    private func loadURL(from itemProvider: NSItemProvider) async throws -> URL {
        if itemProvider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            let item = try await itemProvider.loadItem(forTypeIdentifier: UTType.url.identifier)
            if let url = item as? URL {
                return url
            }
        }

        if itemProvider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            let item = try await itemProvider.loadItem(forTypeIdentifier: UTType.plainText.identifier)
            if let urlString = item as? String, let url = URL(string: urlString) {
                return url
            }
        }

        throw NSError(domain: "MemeGTD", code: 2, userInfo: [NSLocalizedDescriptionKey: "No valid URL found"])
    }

    private func loadAndExtract(url: URL) {
        updateStatus("Loading page...")
        webView.load(URLRequest(url: url))
    }

    private func executeExtraction() {
        updateStatus("Extracting article...")

        guard let jsPath = Bundle.main.path(forResource: "extractor.bundle", ofType: "js"),
              let jsCode = try? String(contentsOfFile: jsPath, encoding: .utf8) else {
            showError("Failed to load extractor")
            return
        }

        webView.evaluateJavaScript(jsCode) { [weak self] _, error in
            if let error = error {
                self?.showError("Failed to inject extractor: \(error.localizedDescription)")
                return
            }

            guard let webView = self?.webView else { return }

            let extractScript = """
            const result = await window.MemeGTDExtractor.extractArticle();
            return result;
            """

            webView.callAsyncJavaScript(
                extractScript,
                arguments: [:],
                in: nil,
                in: .page
            ) { result in
                switch result {
                case .success(let value):
                    guard let jsonString = value as? String,
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

                        self?.save(article: article)
                    } catch {
                        self?.showError("Failed to parse article: \(error.localizedDescription)")
                    }

                case .failure(let error):
                    self?.showError("Extraction failed: \(error.localizedDescription)")
                }
            }
        }
    }

    /// Routes the extracted article by Storage Mode (App Group UserDefaults,
    /// offline support plan Phase 10): Standalone saves into the on-device
    /// App Group database, Server keeps the pre-Phase-10 POST /api/articles.
    private func save(article: ExtractedArticle) {
        if Settings.shared.appMode == .standalone {
            saveLocally(article: article)
        } else {
            saveToAPI(article: article)
        }
    }

    /// Standalone mode: inserts the article into the shared App Group
    /// database (GRDB DatabasePool + WAL, safe alongside the app process).
    /// `LocalArticleStore.insertArticle` applies the same semantics as the
    /// server's POST /api/articles, so a later move to Server mode carries
    /// these rows over losslessly.
    private func saveLocally(article: ExtractedArticle) {
        updateStatus("Saving on device...")

        Task {
            do {
                let uuid = UUIDv7.generate()
                let now = ISO8601Millis.now()
                try await AppDatabase.shared.dbWriter.write { db in
                    try LocalArticleStore.insertArticle(
                        db,
                        uuid: uuid,
                        title: article.title,
                        bodyMd: article.content,
                        originalUrl: article.originalUrl,
                        siteName: article.siteName,
                        now: now
                    )
                }
                await MainActor.run {
                    showSuccess("Article saved!")
                }
            } catch {
                await MainActor.run {
                    showError("Failed to save article: \(error.localizedDescription)")
                }
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
        statusLabel.textColor = UIColor(red: 45/255, green: 164/255, blue: 78/255, alpha: 1)

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

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }

    private func showError(_ message: String) {
        DispatchQueue.main.async {
            self.activityIndicator.stopAnimating()
            self.statusLabel.text = message
            self.statusLabel.textColor = .systemRed

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
