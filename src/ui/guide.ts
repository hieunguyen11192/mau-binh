/**
 * Sheet hướng dẫn cách chơi / luật (tiếng Việt).
 */
export function createGuideSheet(): {
  root: HTMLElement
  open: () => void
  close: () => void
} {
  const root = document.createElement('div')
  root.className = 'guide-overlay'
  root.hidden = true
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-labelledby', 'guide-title')

  root.innerHTML = `
    <div class="guide-sheet">
      <header class="guide-header">
        <h2 id="guide-title">Hướng dẫn chơi Mậu Binh</h2>
        <button type="button" class="btn guide-close" data-close aria-label="Đóng">✕</button>
      </header>
      <div class="guide-body">
        <section>
          <h3>1. Tổng quan</h3>
          <p>Bạn chơi <strong>1 người vs 3 máy</strong>. Mỗi ván dùng bộ bài Tây 52 lá; mỗi nhà nhận <strong>13 lá</strong>.</p>
          <p>Mục tiêu: xếp bài thành 3 chi hợp lệ, thắng điểm khi so chi với đối thủ, cộng thêm điểm từ <strong>So Át</strong> và <strong>Át to nhất</strong>.</p>
        </section>

        <section>
          <h3>2. Cách xếp bài</h3>
          <ul>
            <li><strong>Chi Trước</strong>: 3 lá</li>
            <li><strong>Chi Giữa</strong>: 5 lá</li>
            <li><strong>Chi Sau</strong>: 5 lá</li>
          </ul>
          <p>Thứ tự sức mạnh bắt buộc: <strong>Chi Sau ≥ Chi Giữa ≥ Chi Trước</strong>. Xếp sai gọi là <strong>binh</strong> — ván đó điểm chi = 0 (như úp bài), nhưng vẫn tham gia So Át / Át to.</p>
          <p>Thao tác: chọn lá trên khay → bấm ô chi để đặt. Có nút <strong>Theo chất</strong> / <strong>Nhỏ → lớn</strong> để sắp bài trên tay. Một số mức độ khó có <strong>Xếp gợi ý</strong>.</p>
        </section>

        <section>
          <h3>3. Điểm so chi</h3>
          <p>Sau khi cả bàn khóa bài, mỗi cặp người chơi so lần lượt 3 chi. Ai mạnh hơn nhận điểm theo loại bài (đôi, sảnh, thùng, cù lũ, tứ quý…); ai thua trừ điểm tương ứng.</p>
          <p>Thắng cả 3 chi trước một đối thủ có thể được nhân điểm (sập). Có thể khai <strong>Mậu binh đặc biệt</strong> (rồng, sáu đôi, ba thùng, ba sảnh…) ở mức độ khó cho phép — khi đó không so chi thường mà tính điểm đặc biệt.</p>
          <p><strong>Úp bài</strong>: bỏ so chi (điểm chi = 0), vẫn tính So Át / Át to.</p>
        </section>

        <section>
          <h3>4. So Át (hũ 60 điểm)</h3>
          <p>Mỗi nhà bỏ <strong>15 điểm</strong>/ván → tổng hũ <strong>60</strong>. Hũ chia theo hạng:</p>
          <table class="guide-table">
            <thead><tr><th>Hạng</th><th>Nhận từ hũ</th><th>Net (sau khi bỏ 15)</th></tr></thead>
            <tbody>
              <tr><td>Nhất</td><td>30</td><td>+15</td></tr>
              <tr><td>Nhì</td><td>20</td><td>+5</td></tr>
              <tr><td>Ba</td><td>10</td><td>−5</td></tr>
              <tr><td>Tư (Bét)</td><td>0</td><td>−15</td></tr>
            </tbody>
          </table>
          <p><strong>Cách xếp hạng So Át</strong> (theo 13 lá đã chia, không phụ thuộc cách xếp chi):</p>
          <ol>
            <li>Nhiều <strong>Át (A)</strong> hơn → xếp trên.</li>
            <li>Cùng số Át (&gt; 0): so <strong>Át mạnh nhất</strong> theo chất <strong>♥ &gt; ♦ &gt; ♣ &gt; ♠</strong>.</li>
            <li>Nhóm còn lại đều <strong>0 Át</strong>: so <strong>Hai (lá 2)</strong> — đếm số Hai, hòa thì so chất Hai mạnh nhất (cùng thứ tự chất).</li>
            <li>Vẫn hòa: chia đều điểm các hạng bị chiếm.</li>
          </ol>
        </section>

        <section>
          <h3>5. Át to nhất (hũ 20 điểm)</h3>
          <p>Mỗi nhà bỏ thêm <strong>5 điểm</strong>/ván → hũ <strong>20</strong>.</p>
          <p>Ai cầm <strong>Át mạnh nhất</strong> trên bàn (♥ &gt; ♦ &gt; ♣ &gt; ♠) ăn cả hũ → net <strong>+15</strong>; ba nhà kia <strong>−5</strong>.</p>
          <p>Không ai có Át: chia đều hũ (net 0 mỗi nhà).</p>
        </section>

        <section>
          <h3>6. Tổng điểm một ván</h3>
          <p><code>Tổng = Điểm chi + So Át (net) + Át to (net)</code></p>
          <p>Điểm cộng dồn giữ qua nhiều ván (nút <strong>Ván mới</strong>).</p>
        </section>

        <section>
          <h3>7. Độ khó</h3>
          <table class="guide-table">
            <thead>
              <tr><th>Mức</th><th>Máy</th><th>Xếp gợi ý</th><th>Úp bài</th><th>Peek bot</th><th>Khai đặc biệt</th></tr>
            </thead>
            <tbody>
              <tr><td>Jô</td><td>Yếu</td><td>Có</td><td>Không</td><td>Có</td><td>Có (người)</td></tr>
              <tr><td>Đầm</td><td>Trung bình−</td><td>Có</td><td>Không</td><td>Có</td><td>Có (người)</td></tr>
              <tr><td>Già</td><td>Khá</td><td>Có</td><td>Có</td><td>Có</td><td>Có (cả máy)</td></tr>
              <tr><td>Át</td><td>Mạnh nhất</td><td>Không</td><td>Có</td><td>Không</td><td>Máy có / người không aid</td></tr>
            </tbody>
          </table>
          <p><strong>Peek</strong>: ở mức cho phép, click bài úp của bot để xem tạm (click lại để ẩn).</p>
        </section>

        <section>
          <h3>8. Mẹo nhanh</h3>
          <ul>
            <li>Ưu tiên Chi Sau mạnh, tránh binh.</li>
            <li>Số Át ảnh hưởng lớn tới So Át; Át cơ (♥) quyết định Át to nhất.</li>
            <li>Úp bài khi tay quá yếu (mức Già/Át) — vẫn có thể thắng So Át / Át to.</li>
          </ul>
        </section>
      </div>
      <footer class="guide-footer">
        <button type="button" class="btn btn-primary" data-close>Đã hiểu</button>
      </footer>
    </div>
  `

  function open(): void {
    root.hidden = false
    document.body.classList.add('guide-open')
  }

  function close(): void {
    root.hidden = true
    document.body.classList.remove('guide-open')
  }

  root.addEventListener('click', (e) => {
    if (e.target === root) close()
  })
  root.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', close)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden) close()
  })

  return { root, open, close }
}
