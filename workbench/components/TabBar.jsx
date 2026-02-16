export function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onAddTab }) {
  return (
    <div className="tab-bar">
      <span className="tab-bar-title">strudel-oven</span>
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => onSelectTab(tab.id)}
        >
          <span className="tab-name">{tab.trackName.replace(/\.strudel$/, '')}</span>
          <button
            className="tab-close"
            onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
          >×</button>
        </div>
      ))}
      <button className="tab-add" onClick={onAddTab}>+</button>
    </div>
  )
}
