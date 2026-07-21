import Combine
import SwiftUI

@MainActor
final class ImageAttachmentCoordinator: ObservableObject {
    typealias Uploader = (Data, String, String) async throws -> String

    @Published var isImagePickerPresented = false
    @Published var isSizePickerPresented = false
    @Published var isUploading = false
    @Published var pickedImageData: Data?
    @Published var pickedMimeType = "image/jpeg"
    @Published var pickedExtension = "jpg"

    private let minimumUploadDuration: TimeInterval
    private let uploader: Uploader

    init(
        minimumUploadDuration: TimeInterval = 0.75,
        uploader: @escaping Uploader = { data, filename, mimeType in
            let response = try await APIClient.shared.uploadImage(
                imageData: data,
                filename: filename,
                mimeType: mimeType
            )
            return response.markdownRef
        }
    ) {
        self.minimumUploadDuration = minimumUploadDuration
        self.uploader = uploader
    }

    func presentImagePicker() {
        resetSelection()
        isImagePickerPresented = true
    }

    func imageDataDidChange() {
        guard pickedImageData != nil, !isImagePickerPresented else { return }
        isSizePickerPresented = true
    }

    func cancelSizeSelection() {
        isSizePickerPresented = false
        resetSelection()
    }

    func upload(
        data: Data,
        mimeType: String,
        ext: String
    ) async -> String? {
        isSizePickerPresented = false
        resetSelection()
        isUploading = true
        HapticManager.impact(.medium)

        let start = Date()
        defer { isUploading = false }

        do {
            let filename = "\(UUID().uuidString).\(ext)"
            let markdownReference = try await uploader(data, filename, mimeType)

            let remaining = minimumUploadDuration - Date().timeIntervalSince(start)
            if remaining > 0 {
                try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
            }

            HapticManager.notification(.success)
            return markdownReference
        } catch {
            HapticManager.notification(.error)
            return nil
        }
    }

    static func appending(markdownReference: String, to text: String) -> String {
        text.isEmpty ? markdownReference : "\(text)\n\(markdownReference)"
    }

    private func resetSelection() {
        pickedImageData = nil
        pickedMimeType = "image/jpeg"
        pickedExtension = "jpg"
    }
}

private struct ImageAttachmentPresentationModifier: ViewModifier {
    @ObservedObject var coordinator: ImageAttachmentCoordinator
    @Binding var text: String

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: $coordinator.isImagePickerPresented) {
                ImagePicker(
                    imageData: $coordinator.pickedImageData,
                    imageMimeType: $coordinator.pickedMimeType,
                    imageExtension: $coordinator.pickedExtension
                )
            }
            .onChange(of: coordinator.pickedImageData) { _, _ in
                coordinator.imageDataDidChange()
            }
            .onChange(of: coordinator.isImagePickerPresented) { _, isPresented in
                if !isPresented {
                    coordinator.imageDataDidChange()
                }
            }
            .sheet(isPresented: $coordinator.isSizePickerPresented) {
                if let data = coordinator.pickedImageData {
                    ImageSizePickerSheet(
                        imageData: data,
                        mimeType: coordinator.pickedMimeType,
                        ext: coordinator.pickedExtension,
                        onSelect: { resizedData, mime, ext in
                            Task {
                                guard let markdownReference = await coordinator.upload(
                                    data: resizedData,
                                    mimeType: mime,
                                    ext: ext
                                ) else { return }

                                text = ImageAttachmentCoordinator.appending(
                                    markdownReference: markdownReference,
                                    to: text
                                )
                            }
                        },
                        onCancel: coordinator.cancelSizeSelection
                    )
                    .presentationDetents([.medium])
                }
            }
    }
}

extension View {
    func imageAttachmentPresentation(
        coordinator: ImageAttachmentCoordinator,
        text: Binding<String>
    ) -> some View {
        modifier(ImageAttachmentPresentationModifier(coordinator: coordinator, text: text))
    }
}
