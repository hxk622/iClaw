tell application "Google Chrome"
  activate
  tell active tab of front window
    execute javascript "document.documentElement.classList.add('dark'); document.documentElement.dataset.theme = 'dark'; var card = document.querySelector('.openclaw-chat-surface .chat-tool-card:not([hidden])'); if (card) { card.scrollIntoView({block: 'center', inline: 'nearest'}); }"
  end tell
end tell
