import SwiftUI
import UIKit

/// Restores the interactive swipe-back gesture when .navigationBarBackButtonHidden(true) is used.
extension View {
    func enableSwipeBack() -> some View {
        background(SwipeBackRepresentable())
    }
}

private struct SwipeBackRepresentable: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        SwipeBackViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

private class SwipeBackViewController: UIViewController {
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.interactivePopGestureRecognizer?.isEnabled = true
        navigationController?.interactivePopGestureRecognizer?.delegate = nil
    }
}
