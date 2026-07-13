import SwiftUI
import XCTest

@testable import MemeGTD

/// Renders the new template views to PNGs in the App Group container so the
/// layout can be inspected before deploying (see memory:
/// verify-ios-ui-render-before-report). Temporary verification aid.
@MainActor
final class TemplateViewRenderTests: XCTestCase {
    private func containerURL() throws -> URL {
        guard
            let url = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: "group.com.memegtd.app")
        else {
            throw XCTSkip("App Group container unavailable")
        }
        return url
    }

    private func writePNG<V: View>(_ view: V, name: String) throws {
        let renderer = ImageRenderer(
            content: view.frame(width: 390).background(Color.white))
        renderer.scale = 2
        guard let ui = renderer.uiImage, let data = ui.pngData() else {
            XCTFail("render produced no image")
            return
        }
        let url = try containerURL().appendingPathComponent("render-\(name).png")
        try data.write(to: url)
        print("RENDERED: \(url.path)")
    }

    /// Hosts the view in a real UIWindow and pumps the run loop so ScrollView
    /// content and `.task` blocks actually lay out (ImageRenderer's static
    /// snapshot leaves ScrollView bodies empty).
    private func snapshotInWindow<V: View>(_ view: V, size: CGSize, name: String, settle: TimeInterval = 1.0) throws {
        let host = UIHostingController(rootView: AnyView(view))
        let window = UIWindow(frame: CGRect(origin: .zero, size: size))
        window.rootViewController = host
        window.makeKeyAndVisible()

        let deadline = Date().addingTimeInterval(settle)
        while Date() < deadline {
            RunLoop.main.run(until: Date().addingTimeInterval(0.05))
        }

        window.layoutIfNeeded()
        let renderer = UIGraphicsImageRenderer(size: size)
        let data = renderer.pngData { ctx in
            // drawHierarchy returns a blank image in the headless test host;
            // rendering the layer tree works without a live screen.
            window.layer.render(in: ctx.cgContext)
        }
        let url = try containerURL().appendingPathComponent("render-\(name).png")
        try data.write(to: url)
        print("RENDERED: \(url.path)")
    }

    private var sampleTemplate: Template {
        Template(
            id: 1,
            type: "template",
            templateTarget: "task",
            title: "Deploy checklist",
            bodyMd: "## steps\n- [ ] tag\n- [ ] verify CI",
            createdAt: "2026-07-10T00:00:00Z",
            updatedAt: "2026-07-11T00:00:00Z",
            isBookmarked: false,
            isDeleted: false,
            labels: ["ops"],
            projectIds: []
        )
    }

    func testRenderTemplateCell() throws {
        try writePNG(TemplateCell(template: sampleTemplate), name: "template-cell")
    }

    func testRenderCreateTemplateModal() throws {
        let view = CreateTemplateModal(onCreated: { _ in }, onDismiss: {})
            .environmentObject(DataSourceProvider())
        try snapshotInWindow(view, size: CGSize(width: 390, height: 760), name: "create-template-modal")
    }

    func testRenderTemplateChooserSheet() throws {
        let view = TemplateChooserSheet(
            target: "task",
            onBlank: {},
            onTemplate: { _ in },
            onDismiss: {}
        )
        .environmentObject(DataSourceProvider())
        try snapshotInWindow(view, size: CGSize(width: 390, height: 500), name: "template-chooser")
    }

    func testRenderSharedIssuePrimitives() throws {
        let view = VStack(alignment: .leading, spacing: 12) {
            ModalHeader(title: "Shared Header", onDismiss: {})
            HStack {
                IssueTypeBadge(type: "task")
                CompactRelativeTimeText(iso: "2026-07-13T11:55:00Z")
                IssueLabelChips(labels: ["work", "ios"])
            }
            IssueAreaCard {
                Text("Shared detail card")
                    .padding()
            }
            IssueSectionConnector()
            FeedbackToast(message: "Copied!")
            FloatingCreateButton(action: {})
        }
        try writePNG(view, name: "shared-issue-primitives")
    }

    func testRenderSharedCreationForm() throws {
        let view = VStack(spacing: 0) {
            CreateIssueModalHeader(
                title: "New Item",
                isSubmitting: false,
                isCreateDisabled: false,
                onDismiss: {},
                onCreate: {}
            )
            Divider()
            CreateIssueTextFields(
                titlePlaceholder: "Title...",
                title: .constant("Example"),
                bodyMd: .constant("Body")
            )
            Divider().padding(.leading, 16)
            CreateIssueMetadataSection(
                allLabels: .constant([]),
                selectedLabelNames: .constant([]),
                allProjects: .constant([]),
                selectedProjectIds: .constant([]),
                labelCount: { _ in 0 }
            )
        }
        try writePNG(view, name: "shared-creation-form")
    }

    func testRenderSharedPickerComponents() throws {
        let view = VStack(spacing: 0) {
            SingleChoiceFilterSheet(
                title: "Status",
                options: ["open", "done"],
                selected: "open",
                label: { $0.capitalized },
                onSelect: { _ in },
                onDismiss: {}
            )
            .frame(height: 260)

            ExternalURLForm(
                urlText: .constant("https://example.com"),
                titleText: .constant("Example"),
                onBack: {},
                onSubmit: { _, _ in }
            )
            .frame(height: 360)
        }
        try writePNG(view, name: "shared-picker-components")
    }
}
