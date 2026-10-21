export function InboxView() {
  return <section className="projects-page" aria-labelledby="inbox-title">
    <header className="projects-heading"><div><div className="eyebrow">WORKSPACE</div><h1 id="inbox-title">Inbox</h1><p>Notifications and mentions will appear here when an inbox feed is connected.</p></div></header>
    <div className="projects-state"><strong>Inbox is not connected yet</strong><span>No notification feed or unread-message data is implemented. The previous “3” badge was a placeholder and has been removed.</span></div>
  </section>
}
