import Combine
import Foundation

/// One presentation identity for a creation form. The payload captures the
/// blank/template choice so SwiftUI never reuses a previous form's state.
struct CreationPresentationRequest<Payload>: Identifiable {
    let id = UUID()
    let payload: Payload
}

/// Owns the chooser -> dismissal -> creation-sheet transition shared by issue
/// creation screens. A selected payload is promoted only after the chooser has
/// finished dismissing, avoiding overlapping sheets and stale form identity.
@MainActor
final class CreationPresentationCoordinator<Payload>: ObservableObject {
    @Published var isChooserPresented = false
    @Published var activeRequest: CreationPresentationRequest<Payload>?

    private var pendingPayload: Payload?
    private var hasPendingPayload = false

    func beginChoosing() {
        pendingPayload = nil
        hasPendingPayload = false
        isChooserPresented = true
    }

    func choose(_ payload: Payload) {
        pendingPayload = payload
        hasPendingPayload = true
        isChooserPresented = false
    }

    func chooserDidDismiss() {
        guard hasPendingPayload, let payload = pendingPayload else { return }
        pendingPayload = nil
        hasPendingPayload = false
        activeRequest = CreationPresentationRequest(payload: payload)
    }

    func cancelChooser() {
        pendingPayload = nil
        hasPendingPayload = false
        isChooserPresented = false
    }

    func present(_ payload: Payload) {
        activeRequest = CreationPresentationRequest(payload: payload)
    }

    func dismissForm() {
        activeRequest = nil
    }
}
