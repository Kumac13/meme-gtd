import SwiftUI

enum IssueDetailInitialPosition: Equatable {
    case top
    case bottom
}

enum IssueDetailScrollTrigger: Equatable {
    case initialContent
    case composerExpanded
    case submissionCompleted
}

struct IssueDetailScrollPolicy: Equatable {
    let initialPosition: IssueDetailInitialPosition

    func shouldScrollToBottom(for trigger: IssueDetailScrollTrigger) -> Bool {
        switch trigger {
        case .initialContent:
            initialPosition == .bottom
        case .composerExpanded, .submissionCompleted:
            true
        }
    }
}

struct IssueDetailScrollActions {
    fileprivate let request: (IssueDetailScrollTrigger) -> Void

    func composerDidExpand() {
        request(.composerExpanded)
    }

    func submissionDidComplete() {
        request(.submissionCompleted)
    }
}

/// Detail共通の初期位置と、明示的な操作後の最下部scrollを管理する。
/// 各画面はScrollViewの見た目を所有し、位置制御だけをこのshellへ委譲する。
struct IssueDetailScrollShell<Content: View>: View {
    private static var bottomAnchorID: String { "issueDetailBottom" }

    let policy: IssueDetailScrollPolicy
    let isContentReady: Bool
    @ViewBuilder let content: (IssueDetailScrollActions) -> Content

    @State private var didHandleInitialContent = false

    var body: some View {
        ScrollViewReader { proxy in
            content(
                IssueDetailScrollActions { trigger in
                    requestScroll(for: trigger, proxy: proxy)
                }
            )
            .onChange(of: isContentReady, initial: true) { _, isReady in
                guard isReady, !didHandleInitialContent else { return }
                didHandleInitialContent = true
                requestScroll(for: .initialContent, proxy: proxy)
            }
        }
    }

    private func requestScroll(for trigger: IssueDetailScrollTrigger, proxy: ScrollViewProxy) {
        guard policy.shouldScrollToBottom(for: trigger) else { return }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation {
                proxy.scrollTo(Self.bottomAnchorID, anchor: .bottom)
            }
        }
    }
}

struct IssueDetailBottomAnchor: View {
    var height: CGFloat = 24

    var body: some View {
        Color.clear
            .frame(height: height)
            .id("issueDetailBottom")
    }
}
