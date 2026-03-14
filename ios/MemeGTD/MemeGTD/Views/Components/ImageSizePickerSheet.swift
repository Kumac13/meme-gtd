import SwiftUI
import UIKit

enum ImageSizeOption: String, CaseIterable, Identifiable {
    case small = "Small"
    case medium = "Medium"
    case large = "Large"
    case original = "Original"

    var id: String { rawValue }

    var maxDimension: CGFloat? {
        switch self {
        case .small: return 640
        case .medium: return 1280
        case .large: return 2048
        case .original: return nil
        }
    }
}

struct ImageSizePickerSheet: View {
    let imageData: Data
    let mimeType: String
    let ext: String
    let onSelect: (Data, String, String) -> Void
    let onCancel: () -> Void

    private var image: UIImage? {
        UIImage(data: imageData)
    }

    private func sizeLabel(for option: ImageSizeOption) -> String {
        guard let img = image else { return option.rawValue }

        if option == .original {
            let kb = imageData.count / 1024
            let sizeStr = kb >= 1024 ? String(format: "%.1f MB", Double(kb) / 1024.0) : "\(kb) KB"
            return "\(option.rawValue) (\(Int(img.size.width))×\(Int(img.size.height)), \(sizeStr))"
        }

        guard let maxDim = option.maxDimension else { return option.rawValue }
        let w = img.size.width
        let h = img.size.height
        let maxSide = max(w, h)

        if maxSide <= maxDim {
            // No resize needed, same as original
            let kb = imageData.count / 1024
            let sizeStr = kb >= 1024 ? String(format: "%.1f MB", Double(kb) / 1024.0) : "\(kb) KB"
            return "\(option.rawValue) (\(Int(w))×\(Int(h)), \(sizeStr))"
        }

        let scale = maxDim / maxSide
        let newW = Int(w * scale)
        let newH = Int(h * scale)

        if let resized = resizeImage(img, maxDimension: maxDim) {
            let resizedData = resized.jpegData(compressionQuality: 0.8) ?? Data()
            let kb = resizedData.count / 1024
            let sizeStr = kb >= 1024 ? String(format: "%.1f MB", Double(kb) / 1024.0) : "\(kb) KB"
            return "\(option.rawValue) (\(newW)×\(newH), \(sizeStr))"
        }

        return "\(option.rawValue) (\(newW)×\(newH))"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: onCancel) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(Color(.tertiaryLabel))
                }
                Spacer()
                Text("Image Size")
                    .font(.system(size: 17, weight: .semibold))
                Spacer()
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 28))
                    .hidden()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            VStack(alignment: .leading, spacing: 0) {
                ForEach(ImageSizeOption.allCases) { option in
                    Button(action: {
                        HapticManager.selection()
                        let (data, mime, ext) = processImage(option: option)
                        onSelect(data, mime, ext)
                    }) {
                        HStack {
                            Text(sizeLabel(for: option))
                                .font(.system(size: 16))
                                .foregroundColor(.textPrimary)
                            Spacer()
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    }
                    Divider().padding(.leading, 16)
                }
            }

            Spacer()
        }
        .background(Color(.systemBackground))
    }

    private func processImage(option: ImageSizeOption) -> (Data, String, String) {
        guard let img = image, let maxDim = option.maxDimension else {
            return (imageData, mimeType, ext)
        }

        let maxSide = max(img.size.width, img.size.height)
        if maxSide <= maxDim {
            return (imageData, mimeType, ext)
        }

        if let resized = resizeImage(img, maxDimension: maxDim),
           let jpegData = resized.jpegData(compressionQuality: 0.8) {
            return (jpegData, "image/jpeg", "jpg")
        }

        return (imageData, mimeType, ext)
    }
}

private func resizeImage(_ image: UIImage, maxDimension: CGFloat) -> UIImage? {
    let w = image.size.width
    let h = image.size.height
    let maxSide = max(w, h)
    guard maxSide > maxDimension else { return image }

    let scale = maxDimension / maxSide
    let newSize = CGSize(width: w * scale, height: h * scale)

    let renderer = UIGraphicsImageRenderer(size: newSize)
    return renderer.image { _ in
        image.draw(in: CGRect(origin: .zero, size: newSize))
    }
}
