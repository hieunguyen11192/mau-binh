import { mountTable } from './ui/table'
import { mountMultiplayer } from './ui/multiplayer'
import { isMultiplayerConfigured } from './multiplayer/supabase'
import '../styles/main.css'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('#app missing')
}

type Mode = 'bot' | 'friends'

function mountModeSwitch(onPick: (mode: Mode) => void): void {
  app!.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.className = 'mode-shell'
  wrap.innerHTML = `
    <div class="mode-card">
      <h1>Mậu Binh</h1>
      <p class="mp-sub">Chọn chế độ chơi</p>
      <div class="mode-actions">
        <button type="button" class="btn btn-primary" data-bot>Chơi với máy (1 vs 3 bot)</button>
        <button type="button" class="btn btn-special" data-friends ${isMultiplayerConfigured() ? '' : 'disabled'} title="${isMultiplayerConfigured() ? '' : 'Cần cấu hình Supabase'}">
          Chơi với bạn (online)
        </button>
      </div>
      ${
        isMultiplayerConfigured()
          ? ''
          : '<p class="status-msg">Chưa có Supabase — chỉ chơi máy.</p>'
      }
    </div>
  `
  app!.appendChild(wrap)
  wrap.querySelector('[data-bot]')!.addEventListener('click', () => onPick('bot'))
  const friends = wrap.querySelector<HTMLButtonElement>('[data-friends]')!
  if (!friends.disabled) {
    friends.addEventListener('click', () => onPick('friends'))
  }
}

function showBot(): void {
  app!.innerHTML = ''
  const bar = document.createElement('div')
  bar.className = 'mode-bar'
  bar.innerHTML = `<button type="button" class="btn" data-modes>← Chế độ</button>`
  app!.appendChild(bar)
  const host = document.createElement('div')
  host.className = 'mode-host'
  app!.appendChild(host)
  bar.querySelector('[data-modes]')!.addEventListener('click', boot)
  mountTable(host)
}

function showFriends(): void {
  app!.innerHTML = ''
  const host = document.createElement('div')
  host.className = 'mode-host'
  app!.appendChild(host)
  mountMultiplayer(host, boot)
}

function boot(): void {
  mountModeSwitch((mode) => {
    if (mode === 'bot') showBot()
    else showFriends()
  })
}

boot()
