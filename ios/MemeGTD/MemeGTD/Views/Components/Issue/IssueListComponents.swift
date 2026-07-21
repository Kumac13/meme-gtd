import SwiftUI
import UIKit

/// 上端から並ぶ標準的な Issue 一覧。
/// Memo は下端基準の timeline なので、このコンテナではなく周辺部品だけを共有する。
struct StandardIssueList<Item: Identifiable, RowContent: View>: View {
    let items: [Item]
    let hasMore: Bool
    let onSelect: (Item) -> Void
    let onLoadMore: () async -> Void
    @ViewBuilder let rowContent: (Item) -> RowContent

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(items) { item in
                    Button {
                        HapticManager.selection()
                        onSelect(item)
                    } label: {
                        rowContent(item)
                            .padding(.horizontal, 16)
                    }
                    .buttonStyle(.plain)

                    Divider()
                        .padding(.horizontal, 16)
                }

                if hasMore {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .onAppear {
                            Task { await onLoadMore() }
                        }
                }
            }
        }
        .scrollDismissesKeyboard(.immediately)
        .scrollEdgeEffectStyle(.soft, for: .bottom)
    }
}

/// 一覧上部に置く filter pill 群の共通レイアウト。
struct IssueListFilterBar<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        HStack(spacing: 8) {
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

/// Memo / Task の keyword・semantic 検索切替。
struct IssueSearchModePicker: View {
    @Binding var selection: SearchMode
    var verticalPadding: CGFloat = 8
    let onChange: () -> Void

    var body: some View {
        Picker("Search Mode", selection: $selection) {
            ForEach(SearchMode.allCases, id: \.self) { mode in
                Text(mode.rawValue).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .background(.regularMaterial, in: Capsule())
        .padding(.horizontal, 16)
        .padding(.vertical, verticalPadding)
        .onChange(of: selection) { _, _ in onChange() }
    }
}

/// 検索中は非表示になる標準の作成ボタン領域。
struct IssueListCreateBar: View {
    let isSearching: Bool
    var disabled: Bool = false
    let action: () -> Void

    var body: some View {
        HStack {
            Spacer()
            FloatingCreateButton(disabled: disabled, action: action)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
        .opacity(isSearching ? 0 : 1)
        .allowsHitTesting(!isSearching)
    }
}

/// 検索・filter 結果をコピーする toolbar action。
struct IssueListExportButton: View {
    let isVisible: Bool
    let isExporting: Bool
    let action: () -> Void

    var body: some View {
        if isVisible {
            Button {
                HapticManager.impact(.light)
                action()
            } label: {
                if isExporting {
                    ProgressView()
                        .controlSize(.mini)
                } else {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 14))
                        .foregroundColor(Color(.systemGray))
                }
            }
            .disabled(isExporting)
        }
    }
}

private struct IssueListRefreshModifier: ViewModifier {
    let action: @MainActor () async -> Void

    func body(content: Content) -> some View {
        content.refreshable {
            HapticManager.impact(.medium)
            let start = Date()

            await action()

            let remaining = 0.75 - Date().timeIntervalSince(start)
            if remaining > 0 {
                try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
            }
            HapticManager.notification(.success)
        }
    }
}

private struct IssueListSearchLifecycleModifier: ViewModifier {
    let isSearching: Bool

    func body(content: Content) -> some View {
        content.onChange(of: isSearching) { _, newValue in
            guard !newValue else { return }
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil,
                from: nil,
                for: nil
            )
        }
    }
}

extension View {
    func issueListRefreshable(action: @escaping @MainActor () async -> Void) -> some View {
        modifier(IssueListRefreshModifier(action: action))
    }

    func issueListSearchLifecycle(isSearching: Bool) -> some View {
        modifier(IssueListSearchLifecycleModifier(isSearching: isSearching))
    }
}
