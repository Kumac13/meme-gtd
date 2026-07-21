import XCTest

@testable import MemeGTD

@MainActor
final class ImageAttachmentCoordinatorTests: XCTestCase {
    func testPresentPickerClearsStaleSelection() {
        let coordinator = ImageAttachmentCoordinator()
        coordinator.pickedImageData = Data([1])
        coordinator.pickedMimeType = "image/png"
        coordinator.pickedExtension = "png"

        coordinator.presentImagePicker()

        XCTAssertTrue(coordinator.isImagePickerPresented)
        XCTAssertNil(coordinator.pickedImageData)
        XCTAssertEqual(coordinator.pickedMimeType, "image/jpeg")
        XCTAssertEqual(coordinator.pickedExtension, "jpg")
    }

    func testCancelSizeSelectionClearsPendingImage() {
        let coordinator = ImageAttachmentCoordinator()
        coordinator.pickedImageData = Data([1])
        coordinator.isSizePickerPresented = true

        coordinator.cancelSizeSelection()

        XCTAssertFalse(coordinator.isSizePickerPresented)
        XCTAssertNil(coordinator.pickedImageData)
    }

    func testMarkdownReferenceAppendPreservesExistingText() {
        XCTAssertEqual(
            ImageAttachmentCoordinator.appending(markdownReference: "![image](one.jpg)", to: ""),
            "![image](one.jpg)"
        )
        XCTAssertEqual(
            ImageAttachmentCoordinator.appending(markdownReference: "![image](two.jpg)", to: "body"),
            "body\n![image](two.jpg)"
        )
    }

    func testUploadReturnsMarkdownReferenceAndResetsPresentationState() async {
        let coordinator = ImageAttachmentCoordinator(
            minimumUploadDuration: 0,
            uploader: { data, filename, mimeType in
                XCTAssertEqual(data, Data([1, 2]))
                XCTAssertTrue(filename.hasSuffix(".png"))
                XCTAssertEqual(mimeType, "image/png")
                return "![image](uploaded.png)"
            }
        )
        coordinator.pickedImageData = Data([9])
        coordinator.isSizePickerPresented = true

        let result = await coordinator.upload(
            data: Data([1, 2]),
            mimeType: "image/png",
            ext: "png"
        )

        XCTAssertEqual(result, "![image](uploaded.png)")
        XCTAssertFalse(coordinator.isUploading)
        XCTAssertFalse(coordinator.isSizePickerPresented)
        XCTAssertNil(coordinator.pickedImageData)
    }
}
