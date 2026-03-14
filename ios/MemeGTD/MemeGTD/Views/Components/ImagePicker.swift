import PhotosUI
import SwiftUI

struct ImagePicker: UIViewControllerRepresentable {
    @Binding var imageData: Data?
    @Binding var imageMimeType: String
    @Binding var imageExtension: String
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.filter = .images
        config.selectionLimit = 1
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let parent: ImagePicker

        init(parent: ImagePicker) {
            self.parent = parent
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            parent.dismiss()

            guard let provider = results.first?.itemProvider else {
                return
            }

            let typeId: String
            if provider.hasItemConformingToTypeIdentifier("public.png") {
                typeId = "public.png"
                parent.imageMimeType = "image/png"
                parent.imageExtension = "png"
            } else if provider.hasItemConformingToTypeIdentifier("com.compuserve.gif") {
                typeId = "com.compuserve.gif"
                parent.imageMimeType = "image/gif"
                parent.imageExtension = "gif"
            } else if provider.hasItemConformingToTypeIdentifier("org.webmproject.webp") {
                typeId = "org.webmproject.webp"
                parent.imageMimeType = "image/webp"
                parent.imageExtension = "webp"
            } else if provider.hasItemConformingToTypeIdentifier("public.jpeg") {
                typeId = "public.jpeg"
                parent.imageMimeType = "image/jpeg"
                parent.imageExtension = "jpg"
            } else {
                typeId = "public.image"
                parent.imageMimeType = "image/jpeg"
                parent.imageExtension = "jpg"
            }

            provider.loadDataRepresentation(forTypeIdentifier: typeId) { data, error in
                guard let data = data, error == nil else {
                    return
                }
                DispatchQueue.main.async {
                    self.parent.imageData = data
                }
            }
        }
    }
}
