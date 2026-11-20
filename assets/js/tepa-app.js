/**
 * TEPA Performance Award 2026 ("Light Up") — Interactive UI Applications
 * Mounts automatically based on [data-tepa-app="quiz|vote|live|admin|hub"]
 */
(function (global) {
  'use strict';

  var Store = global.TepaStore;

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function assetUrl(file) {
    var base = (Store.getConfig().assetsBase || '../tepa-award-theme/assets').replace(/\/+$/, '');
    return base + '/images/' + file;
  }

  function absUrl(relOrAbs) {
    try {
      return new URL(relOrAbs, global.location.href).href;
    } catch (e) {
      return relOrAbs;
    }
  }

  function renderQR(el, text, opts) {
    if (!el || !global.TepaQRCode) return;
    global.TepaQRCode.render(el, text, opts || {});
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function formatDateTimeReceipt(iso) {
    try {
      var d = iso ? new Date(iso) : new Date();
      if (isNaN(d.getTime())) d = new Date();
      return d.toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return '';
    }
  }

  function loadImageSafe(src) {
    return new Promise(function (resolve) {
      if (!src) {
        resolve(null);
        return;
      }
      var settled = false;
      var img = new Image();
      try {
        if (/^https?:\/\//i.test(src) && global.location && global.location.origin) {
          var parsed = new URL(src, global.location.href);
          if (parsed.origin !== global.location.origin) {
            img.crossOrigin = 'anonymous';
          }
        }
      } catch (e) {}
      var timer = setTimeout(function () {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, 1500);
      img.onload = function () {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(img);
        }
      };
      img.onerror = function () {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      };
      img.src = src;
    });
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    var rad = typeof r === 'number'
      ? { tl: r, tr: r, br: r, bl: r }
      : Object.assign({ tl: 0, tr: 0, br: 0, bl: 0 }, r || {});
    ctx.beginPath();
    ctx.moveTo(x + rad.tl, y);
    ctx.lineTo(x + w - rad.tr, y);
    if (rad.tr) ctx.quadraticCurveTo(x + w, y, x + w, y + rad.tr);
    else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - rad.br);
    if (rad.br) ctx.quadraticCurveTo(x + w, y + h, x + w - rad.br, y + h);
    else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + rad.bl, y + h);
    if (rad.bl) ctx.quadraticCurveTo(x, y + h, x, y + h - rad.bl);
    else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + rad.tl);
    if (rad.tl) ctx.quadraticCurveTo(x, y, x + rad.tl, y);
    else ctx.lineTo(x, y);
    ctx.closePath();
  }

  function wrapCanvasText(ctx, text, maxWidth, maxLines) {
    var words = String(text == null ? '' : text).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return ['—'];
    var limit = maxLines || 2;
    var lines = [];
    var current = '';

    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      var candidate = current ? (current + ' ' + word) : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else if (!current) {
        var chunk = word;
        while (chunk.length > 1 && ctx.measureText(chunk + '…').width > maxWidth) {
          chunk = chunk.slice(0, -1);
        }
        lines.push(chunk + '…');
        if (lines.length >= limit) return lines;
        current = '';
      } else {
        lines.push(current);
        if (lines.length >= limit) {
          var prev = lines[lines.length - 1];
          while (prev.length > 1 && ctx.measureText(prev + '…').width > maxWidth) {
            prev = prev.slice(0, -1);
          }
          lines[lines.length - 1] = prev + '…';
          return lines;
        }
        current = word;
        while (ctx.measureText(current).width > maxWidth && current.length > 1) {
          current = current.slice(0, -1);
        }
      }
    }
    if (current) {
      if (lines.length >= limit) {
        var tail = lines[limit - 1];
        while (tail.length > 1 && ctx.measureText(tail + '…').width > maxWidth) {
          tail = tail.slice(0, -1);
        }
        lines[limit - 1] = tail + '…';
      } else {
        lines.push(current);
      }
    }
    return lines.slice(0, limit);
  }

  function strToAsciiBytes(str) {
    var arr = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) {
      arr[i] = str.charCodeAt(i) & 0xff;
    }
    return arr;
  }

  function buildJpegPdfBytes(jpegBytes, pxW, pxH) {
    var parts = [];
    var offset = 0;
    function pushBytes(u8) {
      parts.push(u8);
      offset += u8.length;
    }
    function pushStr(s) {
      pushBytes(strToAsciiBytes(s));
    }

    pushBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

    var offsets = [0];
    offsets[1] = offset;
    pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    offsets[2] = offset;
    pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

    offsets[3] = offset;
    pushStr('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');

    offsets[4] = offset;
    pushStr('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + pxW + ' /Height ' + pxH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegBytes.length + ' >>\nstream\n');
    pushBytes(jpegBytes);
    pushStr('\nendstream\nendobj\n');

    var stream5 = 'q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ';
    offsets[5] = offset;
    pushStr('5 0 obj\n<< /Length ' + stream5.length + ' >>\nstream\n' + stream5 + '\nendstream\nendobj\n');

    var xrefOffset = offset;
    var xrefLines = ['xref\n0 6\n', '0000000000 65535 f \n'];
    for (var i = 1; i <= 5; i++) {
      xrefLines.push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    }
    pushStr(xrefLines.join(''));
    pushStr('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n');

    var out = new Uint8Array(offset);
    var pos = 0;
    for (var p = 0; p < parts.length; p++) {
      out.set(parts[p], pos);
      pos += parts[p].length;
    }
    return out;
  }

  var PDF_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>';

  async function downloadReceiptPdf(opts) {
    opts = opts || {};
    var isQuiz = opts.kind === 'quiz';
    var fontStack = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    var lightUpLogo = null;
    var teLogo = null;
    try {
      var imgs = await Promise.all([
        loadImageSafe(assetUrl('light-up-logo.png')),
        loadImageSafe(assetUrl('totalenergies-logo.png'))
      ]);
      lightUpLogo = imgs[0];
      teLogo = imgs[1];
    } catch (e) {}

    var canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    var ctx = canvas.getContext('2d');

    function renderReceiptCanvas(withImages) {
      var W = canvas.width;
      var H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#F2F4F8';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.shadowColor = 'rgba(15, 16, 25, 0.14)';
      ctx.shadowBlur = 38;
      ctx.shadowOffsetY = 14;
      drawRoundedRect(ctx, 70, 70, 1100, 1614, 32);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();

      // Top dark header
      drawRoundedRect(ctx, 70, 70, 1100, 300, { tl: 32, tr: 32, br: 0, bl: 0 });
      ctx.fillStyle = '#0F1019';
      ctx.fill();

      if (withImages && lightUpLogo && lightUpLogo.naturalWidth > 0) {
        var luRatio = lightUpLogo.naturalWidth / lightUpLogo.naturalHeight;
        var luH = 92;
        var luW = luH * luRatio;
        if (luW > 380) { luW = 380; luH = luW / luRatio; }
        ctx.drawImage(lightUpLogo, (W - luW) / 2, 116 + (92 - luH) / 2, luW, luH);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 50px ' + fontStack;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LIGHT UP', W / 2, 164);
      }

      // Pill badge in header
      var badgeText = isQuiz ? '✓  QUIZ COMPLETED' : '✓  VOTE CONFIRMED';
      ctx.font = '700 21px ' + fontStack;
      var badgeW = Math.max(300, ctx.measureText(badgeText).width + 64);
      var badgeX = (W - badgeW) / 2;
      var badgeY = 244;
      var badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
      badgeGrad.addColorStop(0, '#F27922');
      badgeGrad.addColorStop(1, '#E72428');
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, 50, 25);
      ctx.fillStyle = badgeGrad;
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, W / 2, badgeY + 26);

      // 6px rainbow bar
      var rbGrad = ctx.createLinearGradient(70, 0, 1170, 0);
      rbGrad.addColorStop(0, '#F77B39');
      rbGrad.addColorStop(0.28, '#8F4F9E');
      rbGrad.addColorStop(0.55, '#2194D4');
      rbGrad.addColorStop(0.78, '#64BD75');
      rbGrad.addColorStop(1, '#FFD239');
      ctx.fillStyle = rbGrad;
      ctx.fillRect(70, 364, 1100, 6);

      // Document kicker & heading
      ctx.fillStyle = '#64687A';
      ctx.font = '700 18px ' + fontStack;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('OFFICIAL PARTICIPATION RECEIPT · COMPROVATIVO', W / 2, 408);

      ctx.fillStyle = '#10121B';
      ctx.font = '800 42px ' + fontStack;
      ctx.fillText(isQuiz ? 'Quiz Participation Confirmed' : 'Official Vote Recorded', W / 2, 444);

      // Highlighted Dark Code Box
      ctx.save();
      drawRoundedRect(ctx, 140, 526, 960, 252, 24);
      ctx.fillStyle = '#141624';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 9]);
      ctx.strokeStyle = '#FFD239';
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#C7C9D9';
      ctx.font = '700 20px ' + fontStack;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(isQuiz ? 'UNIQUE PARTICIPANT ID' : 'VOTE RECEIPT CODE', W / 2, 560);

      var codeStr = String(opts.code || '—');
      ctx.fillStyle = '#FFD239';
      ctx.font = '800 70px ' + fontStack;
      ctx.fillText(codeStr, W / 2, 606);

      ctx.fillStyle = '#D4D6E6';
      ctx.font = '500 20px ' + fontStack;
      ctx.fillText(
        isQuiz
          ? 'Verification at Prize Desk via TEPA Unique ID'
          : 'Verified Real-Time Auditorium Ballot',
        W / 2,
        708
      );

      // Metadata rows
      var rows = [];
      if (isQuiz) {
        rows.push({ label: 'PARTICIPANT', value: opts.fullName || '—' });
        rows.push({ label: 'QUIZ / EVENT', value: opts.eventTitle || 'TEPA 2026 — Welcome Quiz' });
        rows.push({ label: 'DATE & TIME', value: formatDateTimeReceipt(opts.createdAt) });
        rows.push({ label: 'VERIFICATION', value: 'TEPA Unique ID (Winners announced on 16:9 Stage Screen)' });
      } else {
        rows.push({ label: 'SELECTED CHOICE', value: opts.choiceTitle || '—' });
        if (opts.choiceMeta) {
          rows.push({ label: 'CATEGORY / TEAM', value: opts.choiceMeta });
        }
        rows.push({ label: 'POLL / EVENT', value: opts.eventTitle || 'TEPA Performance Award 2026' });
        rows.push({ label: 'DATE & TIME', value: formatDateTimeReceipt(opts.createdAt) });
      }

      var curY = 824;
      var rowStep = rows.length <= 3 ? 128 : 108;
      for (var rIdx = 0; rIdx < rows.length; rIdx++) {
        var item = rows[rIdx];
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#6B7085';
        ctx.font = '700 17px ' + fontStack;
        ctx.fillText(item.label, 148, curY);

        ctx.fillStyle = '#10121B';
        ctx.font = '700 25px ' + fontStack;
        var valLines = wrapCanvasText(ctx, item.value, 944, 2);
        for (var l = 0; l < valLines.length; l++) {
          ctx.fillText(valLines[l], 148, curY + 26 + l * 30);
        }

        if (rIdx < rows.length - 1) {
          var divY = curY + (valLines.length > 1 ? 94 : rowStep - 18);
          ctx.fillStyle = '#E9ECF4';
          ctx.fillRect(148, divY, 944, 2);
        }
        curY += rowStep;
      }

      // Guidance Footer Callout
      drawRoundedRect(ctx, 140, 1286, 960, 162, 18);
      ctx.fillStyle = '#F7F8FC';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#E2E6F0';
      ctx.stroke();

      ctx.fillStyle = '#4B5066';
      ctx.font = '500 20px ' + fontStack;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      var noteText = isQuiz
        ? 'Keep this PDF receipt saved on your device. When the quiz winners are announced live on the 16:9 auditorium stage screen, present your TEPA Unique ID at the Prize Desk.'
        : 'Your single-device vote has been officially registered and is updating live on the 16:9 auditorium screen. Keep this PDF receipt as your confirmation.';
      var noteLines = wrapCanvasText(ctx, noteText, 880, 4);
      var noteStartY = 1286 + Math.max(24, (162 - noteLines.length * 30) / 2);
      for (var nl = 0; nl < noteLines.length; nl++) {
        ctx.fillText(noteLines[nl], W / 2, noteStartY + nl * 30);
      }

      // Bottom White Brand Bar
      drawRoundedRect(ctx, 70, 1506, 1100, 178, { tl: 0, tr: 0, br: 32, bl: 32 });
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.fillStyle = '#E9ECF4';
      ctx.fillRect(70, 1506, 1100, 2);

      if (withImages && teLogo && teLogo.naturalWidth > 0) {
        var teRatio = teLogo.naturalWidth / teLogo.naturalHeight;
        var teH = 84;
        var teW = teH * teRatio;
        if (teW > 320) { teW = 320; teH = teW / teRatio; }
        ctx.drawImage(teLogo, (W - teW) / 2, 1528 + (84 - teH) / 2, teW, teH);
      } else {
        ctx.fillStyle = '#E72428';
        ctx.font = '800 32px ' + fontStack;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TotalEnergies', W / 2, 1568);
      }

      ctx.fillStyle = '#7A7F94';
      ctx.font = '600 17px ' + fontStack;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('TEPA Performance Award 2026 · Light Up', W / 2, 1632);
    }

    var dataUrl;
    try {
      renderReceiptCanvas(true);
      dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    } catch (e) {
      renderReceiptCanvas(false);
      dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    }

    var b64 = dataUrl.split(',')[1];
    var bin = global.atob(b64);
    var jpegBytes = new Uint8Array(bin.length);
    for (var j = 0; j < bin.length; j++) {
      jpegBytes[j] = bin.charCodeAt(j);
    }

    var pdfBytes = buildJpegPdfBytes(jpegBytes, canvas.width, canvas.height);
    var safeCode = String(opts.code || 'TEPA').replace(/[^A-Za-z0-9_-]/g, '');
    var fileName = (isQuiz ? 'TEPA-Quiz-Receipt-' : 'TEPA-Vote-Receipt-') + safeCode + '.pdf';
    var blob = new Blob([pdfBytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { document.body.removeChild(a); } catch (e) {}
      try { URL.revokeObjectURL(url); } catch (e) {}
    }, 10000);
  }

  function prefersReducedMotion() {
    try {
      return Boolean(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function animateNumber(el, targetVal, formatFn, durationMs, initialFrom) {
    if (!el) return;
    var next = Number(targetVal);
    if (!isFinite(next)) next = 0;
    var fmt = formatFn || function (v) { return String(Math.round(v)); };

    if (el._tepaNumRaf) {
      cancelAnimationFrame(el._tepaNumRaf);
      el._tepaNumRaf = 0;
    }

    var startVal = el._tepaNumVal !== undefined
      ? el._tepaNumVal
      : (initialFrom !== undefined ? Number(initialFrom) : next);

    if (prefersReducedMotion() || !durationMs || startVal === next) {
      el._tepaNumVal = next;
      el.textContent = fmt(next);
      return;
    }

    var startTs = null;
    function step(ts) {
      if (startTs === null) startTs = ts;
      var t = Math.min(1, (ts - startTs) / durationMs);
      var eased = 1 - Math.pow(1 - t, 3);
      var cur = startVal + (next - startVal) * eased;
      el._tepaNumVal = cur;
      el.textContent = fmt(t >= 1 ? next : cur);
      if (t < 1) {
        el._tepaNumRaf = requestAnimationFrame(step);
      } else {
        el._tepaNumVal = next;
        el._tepaNumRaf = 0;
      }
    }
    el._tepaNumRaf = requestAnimationFrame(step);
  }

  function springAnimateBars(container, selector, propName, staggerStep) {
    if (!container) return;
    var bars = Array.from(container.querySelectorAll(selector)).filter(function (bar) {
      return !bar.classList.contains('is-zero');
    });
    if (!bars.length) return;
    if (prefersReducedMotion()) {
      bars.forEach(function (bar) {
        var val = bar.getAttribute('data-target-pct');
        if (val !== null) bar.style[propName] = val + '%';
      });
      return;
    }
    bars.forEach(function (bar) {
      bar.style.transition = 'none';
      bar.style[propName] = '0%';
    });
    void container.offsetWidth;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        bars.forEach(function (bar, idx) {
          var val = bar.getAttribute('data-target-pct');
          bar.style.transition = '';
          if (staggerStep) {
            bar.style.transitionDelay = Math.min(idx, 16) * staggerStep + 'ms';
          }
          if (val !== null) bar.style[propName] = val + '%';
        });
      });
    });
  }

  function flipReorderChildren(parentEl, orderedEls) {
    if (!parentEl || !orderedEls || !orderedEls.length) return false;
    var current = Array.from(parentEl.children);
    var sameOrder = current.length === orderedEls.length && current.every(function (el, i) {
      return el === orderedEls[i];
    });
    if (sameOrder) return false;

    if (prefersReducedMotion()) {
      orderedEls.forEach(function (el) { parentEl.appendChild(el); });
      return true;
    }

    var firstRects = new Map();
    orderedEls.forEach(function (el) {
      firstRects.set(el, el.getBoundingClientRect());
      if (el._flipTimer) {
        clearTimeout(el._flipTimer);
        el._flipTimer = 0;
      }
      if (el._flipRaf) {
        cancelAnimationFrame(el._flipRaf);
        el._flipRaf = 0;
      }
    });

    orderedEls.forEach(function (el) {
      el.style.transition = 'none';
      el.style.transform = 'none';
      parentEl.appendChild(el);
    });

    var moved = [];
    orderedEls.forEach(function (el) {
      var prev = firstRects.get(el);
      var next = el.getBoundingClientRect();
      var dx = prev.left - next.left;
      var dy = prev.top - next.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.style.transform = 'translate3d(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px, 0)';
        moved.push(el);
      }
    });

    if (moved.length) {
      void parentEl.offsetHeight;
      moved.forEach(function (el) {
        el._flipRaf = requestAnimationFrame(function () {
          el._flipRaf = 0;
          el.style.transition = 'transform 500ms cubic-bezier(0.22, 1, 0.36, 1)';
          el.style.transform = 'translate3d(0, 0, 0)';
          el._flipTimer = setTimeout(function () {
            el._flipTimer = 0;
            el.style.transition = '';
            el.style.transform = '';
          }, 530);
        });
      });
    }
    return true;
  }

  // =========================================================================
  // 1. MOBILE WELCOME QUIZ ([data-tepa-app="quiz"])
  // =========================================================================

  function mountQuizApp(root) {
    var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
    var state = {
      step: 'loading', // 'loading' | 'cover' | 'name' | 'questions' | 'result'
      lastStep: null,
      fullName: '',
      activeQuiz: null,
      questions: [],
      answers: {},
      page: 0,
      lastPage: 0,
      pageSize: 2,
      quizOpen: true,
      loading: true,
      submitting: false,
      error: '',
      receipt: null
    };

    function ensureShell() {
      if (root.querySelector('#tepa-quiz-stage')) return;
      root.innerHTML =
        '<div class="tepa-mobile-viewport"><div class="tepa-mobile-shell" id="tepa-quiz-shell">' +
        '  <div class="tepa-bulb-watermark" style="background-image:url(\'' + esc(assetUrl('lightbulb-hero.jpg')) + '\');"></div>' +
        '  <div class="tepa-mobile-content" id="tepa-quiz-stage"></div>' +
        '  <footer class="tepa-brand-footer" id="tepa-quiz-footer">' +
        '    <img src="' + esc(assetUrl('totalenergies-logo.png')) + '" alt="TotalEnergies">' +
        '  </footer>' +
        '</div></div>';
    }

    function getAnswerValue(q) {
      if (state.answers[String(q.id)] !== undefined) return state.answers[String(q.id)];
      if (state.answers[String(q.question_number)] !== undefined) return state.answers[String(q.question_number)];
      return undefined;
    }

    function computeProgress() {
      var total = Math.max(1, state.questions.length);
      var answered = state.questions.filter(function (q) {
        var v = getAnswerValue(q);
        return v !== undefined && v !== null && v !== '';
      }).length;
      return {
        answered: answered,
        total: total,
        pct: state.questions.length ? Math.round((answered / total) * 100) : 0
      };
    }

    async function load() {
      state.loading = true;
      state.step = 'loading';
      render();
      try {
        var results = await Promise.all([
          Store.getPublicQuestions(),
          Store.getDashboardState()
        ]);
        state.questions = results[0] || [];
        var dash = results[1] || {};
        var settings = dash.settings || {};
        state.activeQuiz = dash.active_quiz || null;
        state.pageSize = Math.max(1, Math.min(10, Number((state.activeQuiz && state.activeQuiz.questions_per_page) || 2)));
        state.quizOpen = settings.quiz_open !== undefined ? Boolean(settings.quiz_open) : true;
        var quizEpoch = Number(settings.quiz_epoch || 1);
        var cached = Store.getCachedQuizReceipt(quizEpoch);
        if (cached && cached.unique_code) {
          state.receipt = cached;
          state.step = 'result';
        } else {
          state.step = 'cover';
        }
      } catch (err) {
        state.error = (err && err.message) || 'Could not load quiz questions.';
        state.step = 'cover';
      } finally {
        state.loading = false;
        render();
      }
    }

    function renderDemoResetPill() {
      if (Store.getMode() !== 'demo') return '';
      return (
        '<div style="margin-top:12px;text-align:center;">' +
        '  <button type="button" class="tepa-stage-btn" data-action="sim-new-device" style="font-size:11px;opacity:0.85;">' +
        '    Demo: Simulate New Employee Phone' +
        '  </button>' +
        '</div>'
      );
    }

    function buildQuestionCardsHtml(slice, animCls) {
      return slice.map(function (q, idx) {
        var qKey = String(q.id);
        var qNumLabel = pad2(idx + 1 + state.page * state.pageSize);
        var ans = getAnswerValue(q);
        var isMc = q.question_type === 'multiple_choice' && Array.isArray(q.options) && q.options.length >= 2;
        var inputHtml = '';

        if (isMc) {
          inputHtml =
            '<div class="tepa-mc-grid">' +
            q.options.map(function (optText, optIdx) {
              var isSel = ans !== undefined && Number(ans) === optIdx;
              var cls = isSel ? 'is-selected' : (ans !== undefined ? 'is-dimmed' : '');
              return (
                '<button type="button" class="tepa-mc-btn ' + cls + '" data-action="answer" data-qid="' + esc(qKey) + '" data-qnum="' + esc(q.question_number) + '" data-qtype="multiple_choice" data-val="' + optIdx + '">' +
                '  <span class="tepa-mc-letter">' + (LETTERS[optIdx] || (optIdx + 1)) + '</span>' +
                '  <span>' + esc(optText) + '</span>' +
                '</button>'
              );
            }).join('') +
            '</div>';
        } else {
          var yesCls = ans === true ? 'is-selected' : (ans === false ? 'is-dimmed' : '');
          var noCls = ans === false ? 'is-selected' : (ans === true ? 'is-dimmed' : '');
          inputHtml =
            '<div class="tepa-yn-grid">' +
            '  <button type="button" class="tepa-yn-btn ' + yesCls + '" data-action="answer" data-qid="' + esc(qKey) + '" data-qnum="' + esc(q.question_number) + '" data-qtype="yes_no" data-val="true">' + (ans === true ? '✓ Yes' : 'Yes') + '</button>' +
            '  <button type="button" class="tepa-yn-btn ' + noCls + '" data-action="answer" data-qid="' + esc(qKey) + '" data-qnum="' + esc(q.question_number) + '" data-qtype="yes_no" data-val="false">' + (ans === false ? '✓ No' : 'No') + '</button>' +
            '</div>';
        }

        return (
          '<div class="tepa-question-block ' + (animCls || '') + '" style="animation-delay:' + (idx * 55) + 'ms;" data-qblock="' + esc(qKey) + '">' +
          '  <div class="tepa-question-card">' +
          '    <div class="tepa-question-num">' + esc(qNumLabel) + '</div>' +
          '    <div class="tepa-question-text">' + esc(q.question_text) + '</div>' +
          '  </div>' +
          inputHtml +
          '</div>'
        );
      }).join('');
    }

    function updateQuestionsUiInPlace() {
      var prog = computeProgress();
      var fill = root.querySelector('#tepa-quiz-progress-fill');
      var pctEl = root.querySelector('#tepa-quiz-progress-pct');
      var nextBtn = root.querySelector('#tepa-quiz-next-btn');
      if (fill) fill.style.width = prog.pct + '%';
      if (pctEl) animateNumber(pctEl, prog.pct, function (v) { return Math.round(v) + '%'; }, 360);

      var start = state.page * state.pageSize;
      var slice = state.questions.slice(start, start + state.pageSize);
      var allPageAnswered = slice.every(function (q) {
        var v = getAnswerValue(q);
        return v !== undefined && v !== null && v !== '';
      });

      slice.forEach(function (q) {
        var qKey = String(q.id);
        var block = root.querySelector('[data-qblock="' + qKey + '"]');
        if (!block) return;
        var ans = getAnswerValue(q);
        var btns = block.querySelectorAll('[data-action="answer"]');
        btns.forEach(function (b) {
          var qtype = b.getAttribute('data-qtype');
          var rawVal = b.getAttribute('data-val');
          if (qtype === 'multiple_choice') {
            var optIdx = Number(rawVal);
            var isSelMc = ans !== undefined && Number(ans) === optIdx;
            b.classList.toggle('is-selected', isSelMc);
            b.classList.toggle('is-dimmed', ans !== undefined && !isSelMc);
          } else {
            var boolVal = rawVal === 'true';
            var isSelYn = ans === boolVal;
            b.classList.toggle('is-selected', isSelYn);
            b.classList.toggle('is-dimmed', typeof ans === 'boolean' && !isSelYn);
            b.textContent = (isSelYn ? '✓ ' : '') + (boolVal ? 'Yes' : 'No');
          }
        });
      });

      if (nextBtn) {
        nextBtn.disabled = !(allPageAnswered && !state.submitting);
      }
    }

    function render(directionHint) {
      ensureShell();
      var shell = root.querySelector('#tepa-quiz-shell');
      var stage = root.querySelector('#tepa-quiz-stage');
      var footer = root.querySelector('#tepa-quiz-footer');
      if (!shell || !stage || !footer) return;

      var stepOrder = { loading: 0, cover: 1, name: 2, questions: 3, result: 4 };
      var prevOrd = stepOrder[state.lastStep] || 0;
      var nextOrd = stepOrder[state.step] || 0;
      var animClass = 'tepa-anim-enter';
      if (state.lastStep && state.lastStep !== state.step) {
        animClass = nextOrd >= prevOrd ? 'tepa-anim-slide-next' : 'tepa-anim-slide-prev';
      } else if (directionHint === 'next') {
        animClass = 'tepa-anim-slide-next';
      } else if (directionHint === 'prev') {
        animClass = 'tepa-anim-slide-prev';
      }

      var stepChanged = state.lastStep !== state.step;
      state.lastStep = state.step;

      var quizTitle = (state.activeQuiz && state.activeQuiz.title) || 'Quiz';
      var quizSub = (state.activeQuiz && state.activeQuiz.subtitle) ||
        'Test your knowledge about the TEPA Performance Award and show that you are up to date with this experience!';

      shell.setAttribute('data-player-step', state.step);
      shell.classList.toggle('is-scrollable', state.step !== 'loading');
      footer.style.display = state.step === 'questions' ? 'none' : '';
      if (stepChanged) shell.scrollTop = 0;

      if (state.loading || state.step === 'loading') {
        stage.innerHTML =
          '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;">' +
          '  <img class="tepa-lightup-logo" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">' +
          '  <p style="margin-top:20px;color:#C7C9D9;">Loading TEPA Quiz...</p>' +
          '</div>';
        return;
      }

      if (state.step === 'cover') {
        stage.innerHTML =
          '<div class="tepa-quiz-cover-body ' + animClass + '">' +
          '  <img class="tepa-lightup-logo is-lg" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">' +
          '  <div class="tepa-rainbow-line"></div>' +
          '  <h1 class="tepa-quiz-mega-title' + (quizTitle.length > 10 ? ' is-long-title' : '') + '">' + esc(quizTitle) + '</h1>' +
          '  <p class="tepa-cover-subtitle">' + esc(quizSub) + '</p>' +
          (state.quizOpen
            ? ''
            : '<p style="margin:12px 0 0;padding:8px 14px;border-radius:10px;background:rgba(231,36,40,0.2);border:1px solid #E72428;font-size:13px;">The Welcome Quiz is currently closed.</p>') +
          '  <div class="tepa-cover-cta-wrap">' +
          '    <button type="button" class="tepa-btn-cta" data-action="go-name" ' + (state.quizOpen ? '' : 'disabled') + '>ANSWER</button>' +
          '  </div>' +
          '</div>';
      } else if (state.step === 'name') {
        stage.innerHTML =
          '<div class="tepa-quiz-step-wrap ' + animClass + '">' +
          '  <img class="tepa-lightup-logo is-sm" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">' +
          '  <h1 class="tepa-step-heading tepa-rainbow-text">WELCOME</h1>' +
          '  <p class="tepa-step-sub">First ' + esc((state.activeQuiz && state.activeQuiz.max_vouchers) || 10) + ' winning participants receive a ' + esc((state.activeQuiz && state.activeQuiz.voucher_title) || 'Café Bonjour Breakfast Voucher') + '</p>' +
          '  <form id="tepa-quiz-name-form" class="tepa-gradient-card" style="margin-top:6px;">' +
          '    <label class="tepa-input-label" for="tepa-quiz-fullname">Your Full Name</label>' +
          '    <input id="tepa-quiz-fullname" class="tepa-dark-input" type="text" maxlength="80" autocomplete="name" placeholder="e.g. Maria João Silva" value="' + esc(state.fullName) + '" required>' +
          (state.error ? '<p style="color:#FF8B8E;font-size:13px;margin:10px 0 0;">' + esc(state.error) + '</p>' : '') +
          '    <div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">' +
          '      <button type="submit" class="tepa-btn-cta" style="width:100%;">Start Quiz</button>' +
          '      <button type="button" class="tepa-btn-rainbow-outline is-pill" data-action="back-cover" style="width:100%;">← Back</button>' +
          '    </div>' +
          '  </form>' +
          '</div>';
      } else if (state.step === 'questions') {
        var totalPages = Math.max(1, Math.ceil(state.questions.length / state.pageSize));
        var start = state.page * state.pageSize;
        var slice = state.questions.slice(start, start + state.pageSize);
        var allPageAnswered = slice.every(function (q) {
          var v = getAnswerValue(q);
          return v !== undefined && v !== null && v !== '';
        });
        var prog = computeProgress();
        var isLast = state.page >= totalPages - 1;
        var pageAnim = directionHint === 'prev' ? 'tepa-anim-slide-prev' : 'tepa-anim-slide-next';
        var hasMc = slice.some(function (q) { return q.question_type === 'multiple_choice'; });

        var cardsStage = root.querySelector('#tepa-quiz-cards-stage');
        if (!stepChanged && cardsStage) {
          // Keep header + persistent progress bar smooth while sliding only the question cards!
          cardsStage.setAttribute('data-page-count', String(slice.length));
          cardsStage.innerHTML = buildQuestionCardsHtml(slice, pageAnim);
          var fillEl = root.querySelector('#tepa-quiz-progress-fill');
          var pctEl = root.querySelector('#tepa-quiz-progress-pct');
          var pgLbl = root.querySelector('#tepa-quiz-page-label');
          var nxtBtn = root.querySelector('#tepa-quiz-next-btn');
          var prevBtnWrap = root.querySelector('#tepa-quiz-prev-wrap');
          var errBox = root.querySelector('#tepa-quiz-err');
          if (fillEl) fillEl.style.width = prog.pct + '%';
          if (pctEl) animateNumber(pctEl, prog.pct, function (v) { return Math.round(v) + '%'; }, 360);
          if (pgLbl) pgLbl.textContent = (state.page + 1) + '/' + totalPages;
          if (nxtBtn) {
            nxtBtn.disabled = !(allPageAnswered && !state.submitting);
            nxtBtn.textContent = state.submitting ? 'Submitting...' : (isLast ? 'Submit Answers' : 'Next');
          }
          if (prevBtnWrap) {
            prevBtnWrap.innerHTML = state.page > 0
              ? '<button type="button" class="tepa-btn-rainbow-outline is-pill" data-action="prev-page" style="width:100%;">← Previous Questions</button>'
              : '';
          }
          if (errBox) {
            errBox.textContent = state.error || '';
            errBox.style.display = state.error ? '' : 'none';
          }
          if (state.lastPage !== state.page) shell.scrollTop = 0;
          state.lastPage = state.page;
          return;
        }

        if (state.lastPage !== state.page) shell.scrollTop = 0;
        state.lastPage = state.page;
        stage.innerHTML =
          '<div class="tepa-quiz-step-wrap is-questions ' + animClass + '">' +
          '  <img class="tepa-lightup-logo is-sm" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">' +
          '  <h1 class="tepa-step-heading tepa-rainbow-text" style="margin-top:14px;">' + (hasMc ? esc(quizTitle.toUpperCase()) : 'YES OR NO') + '</h1>' +
          '  <div class="tepa-progress-row">' +
          '    <span class="tepa-progress-meta"><span class="tepa-progress-user">' + esc(state.fullName) + '</span><span class="tepa-progress-sep">·</span><span id="tepa-quiz-page-label">' + (state.page + 1) + '/' + totalPages + '</span></span>' +
          '    <div class="tepa-progress-track"><div class="tepa-progress-fill" id="tepa-quiz-progress-fill" style="width:' + prog.pct + '%;"></div></div>' +
          '    <span class="tepa-progress-pct" id="tepa-quiz-progress-pct">' + prog.pct + '%</span>' +
          '  </div>' +
          '  <div id="tepa-quiz-cards-stage" data-page-count="' + slice.length + '" style="width:100%;">' +
          buildQuestionCardsHtml(slice, 'tepa-anim-enter') +
          '  </div>' +
          '  <p id="tepa-quiz-err" style="color:#FF8B8E;font-size:13px;margin:0 0 10px;text-align:center;' + (state.error ? '' : 'display:none;') + '">' + esc(state.error) + '</p>' +
          '  <div class="tepa-quiz-actions">' +
          '    <button type="button" class="tepa-btn-cta" id="tepa-quiz-next-btn" data-action="next-page" ' + (allPageAnswered && !state.submitting ? '' : 'disabled') + '>' +
          (state.submitting ? 'Submitting...' : (isLast ? 'Submit Answers' : 'Next')) +
          '    </button>' +
          '    <div id="tepa-quiz-prev-wrap">' +
          (state.page > 0
            ? '<button type="button" class="tepa-btn-rainbow-outline is-pill" data-action="prev-page" style="width:100%;">← Previous Questions</button>'
            : '') +
          '    </div>' +
          '  </div>' +
          '</div>';
      } else if (state.step === 'result' && state.receipt) {
        var r = state.receipt;
        var voteUrl = Store.getConfig().voteUrl || 'vote.html';
        var voucherHtml =
          '<div class="tepa-gradient-card tepa-anim-enter" style="text-align:center;margin:16px 0 14px;">' +
          '  <div class="tepa-voucher-badge" style="margin-bottom:8px;">✓ Quiz Completed</div>' +
          '  <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;" class="tepa-rainbow-text">Quiz Recorded!</h2>' +
          '  <p style="margin:0;font-size:13.5px;line-height:1.5;color:#D6D8E8;">' +
          '    Thank you, <strong>' + esc(r.full_name) + '</strong>! Keep your Unique Participant ID below — the quiz winners will be announced live on the 16:9 stage screen.' +
          '  </p>' +
          '</div>';

        stage.innerHTML =
          '<div class="tepa-quiz-step-wrap is-result ' + animClass + '">' +
          '  <img class="tepa-lightup-logo is-sm" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">' +
          voucherHtml +
          '  <div class="tepa-unique-id-box" style="width:100%;">' +
          '    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#C7C9D9;">Unique Participant ID</div>' +
          '    <div class="tepa-unique-id-code" id="tepa-unique-code-val">' + esc(r.unique_code) + '</div>' +
          '    <div style="font-size:12.5px;color:#D4D6E6;margin-bottom:12px;">' + esc(r.full_name) + '</div>' +
          '    <div class="tepa-receipt-actions">' +
          '      <button type="button" class="tepa-stage-btn" data-action="copy-code">Copy Unique ID</button>' +
          '      <button type="button" class="tepa-stage-btn is-pdf" data-action="download-quiz-pdf">' + PDF_ICON_SVG + '<span>Save PDF Receipt</span></button>' +
          '    </div>' +
          '  </div>' +
          '  <div style="width:100%;display:flex;flex-direction:column;gap:10px;margin-top:6px;">' +
          '    <a href="' + esc(voteUrl) + '" class="tepa-btn-cta" style="width:100%;">Open Voting Portal</a>' +
          renderDemoResetPill() +
          '  </div>' +
          '</div>';
      }
    }

    root.addEventListener('submit', function (ev) {
      if (ev.target && ev.target.id === 'tepa-quiz-name-form') {
        ev.preventDefault();
        var input = root.querySelector('#tepa-quiz-fullname');
        var val = (input ? input.value : '').trim();
        if (val.length < 2) {
          state.error = 'Please enter your full name (at least 2 characters).';
          render();
          return;
        }
        state.fullName = val;
        state.error = '';
        state.step = 'questions';
        render('next');
      }
    });

    root.addEventListener('click', async function (ev) {
      if (!ev.target || !ev.target.closest) return;
      var btn = ev.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');

      if (action === 'go-name') {
        state.step = 'name';
        state.error = '';
        render('next');
        var inp = root.querySelector('#tepa-quiz-fullname');
        if (inp) setTimeout(function () { try { inp.focus(); } catch (e) {} }, 120);
      } else if (action === 'back-cover') {
        state.step = 'cover';
        state.error = '';
        render('prev');
      } else if (action === 'answer') {
        var qId = btn.getAttribute('data-qid');
        var qNum = btn.getAttribute('data-qnum');
        var qtype = btn.getAttribute('data-qtype');
        var rawVal = btn.getAttribute('data-val');
        var typedVal = qtype === 'multiple_choice' ? Number(rawVal) : (rawVal === 'true');
        state.answers[String(qId)] = typedVal;
        if (qNum && String(qNum) !== String(qId)) {
          state.answers[String(qNum)] = typedVal;
        }
        updateQuestionsUiInPlace();
      } else if (action === 'prev-page') {
        if (state.page > 0) {
          state.page--;
          render('prev');
        }
      } else if (action === 'next-page') {
        var totalPages = Math.max(1, Math.ceil(state.questions.length / state.pageSize));
        if (state.page < totalPages - 1) {
          state.page++;
          render('next');
        } else {
          state.submitting = true;
          state.error = '';
          updateQuestionsUiInPlace();
          var nBtn = root.querySelector('#tepa-quiz-next-btn');
          if (nBtn) nBtn.textContent = 'Submitting...';
          try {
            var res = await Store.submitQuizAttempt(state.fullName, state.answers);
            if (!res || !res.ok) {
              state.error = (res && res.error) || 'Could not submit your quiz.';
              state.submitting = false;
              render();
              return;
            }
            state.receipt = res;
            state.step = 'result';
          } catch (err) {
            state.error = (err && err.message) || 'Network error while submitting.';
          } finally {
            state.submitting = false;
            render('next');
          }
        }
      } else if (action === 'copy-code') {
        if (state.receipt && navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(state.receipt.unique_code);
            btn.textContent = 'Copied ✓';
            setTimeout(function () { btn.textContent = 'Copy Unique ID'; }, 1800);
          } catch (e) {}
        }
      } else if (action === 'download-quiz-pdf') {
        if (state.receipt && !btn.disabled) {
          var origQuizPdfHtml = btn.innerHTML;
          btn.disabled = true;
          btn.textContent = 'Saving PDF...';
          try {
            await downloadReceiptPdf({
              kind: 'quiz',
              code: state.receipt.unique_code,
              fullName: state.receipt.full_name,
              eventTitle: (state.activeQuiz && state.activeQuiz.title) || 'TEPA 2026 — Welcome Quiz',
              createdAt: state.receipt.created_at
            });
            btn.textContent = 'PDF Saved ✓';
          } catch (e) {
            btn.textContent = 'Retry PDF';
          }
          setTimeout(function () {
            btn.disabled = false;
            btn.innerHTML = origQuizPdfHtml;
          }, 2000);
        }
      } else if (action === 'sim-new-device') {
        Store.rotateSimulatedDeviceId();
        state.step = 'loading';
        state.lastStep = null;
        state.fullName = '';
        state.answers = {};
        state.page = 0;
        state.receipt = null;
        state.error = '';
        await load();
      }
    });

    load();
  }

  // =========================================================================
  // 2. MOBILE VOTING SYSTEM ([data-tepa-app="vote"])
  // =========================================================================

  function mountVoteApp(root) {
    var state = {
      step: 'loading', // 'loading' | 'cover' | 'select' | 'receipt'
      lastStep: null,
      activePoll: null,
      projects: [],
      votingSubtitle: 'You have 15 finalist projects<br>Choose one for Best of the Best',
      selectedProjectId: null,
      votingOpen: true,
      loading: true,
      confirmOpen: false,
      submitting: false,
      error: '',
      receipt: null
    };

    function ensureShell() {
      if (root.querySelector('#tepa-vote-shell')) return;
      root.innerHTML =
        '<div class="tepa-mobile-viewport"><div class="tepa-mobile-shell" id="tepa-vote-shell"></div></div>';
    }

    function isSimpleMode() {
      return Boolean(state.activePoll && state.activePoll.poll_type === 'simple');
    }

    function formatCoverSubtitle(raw, count, isSimple) {
      var n = Number(count || 0);
      var dynamicDefault = isSimple
        ? ('You have ' + n + ' option' + (n === 1 ? '' : 's') + '<br>Choose your preferred choice')
        : ('You have ' + n + ' finalist project' + (n === 1 ? '' : 's') + '<br>Choose one for Best of the Best');
      var str = String(raw || '').trim();
      if (!str || str === 'You have 15 finalist projects · Choose one for Best of the Best') {
        return dynamicDefault;
      }
      if (str.indexOf('·') !== -1) {
        return str.split('·').map(function (part) { return esc(part.trim()); }).join('<br>');
      }
      return esc(str);
    }

    async function load() {
      state.loading = true;
      state.step = 'loading';
      render();
      try {
        var dash = await Store.getDashboardState();
        state.activePoll = (dash && dash.active_poll) || null;
        state.projects = (dash && dash.projects_with_votes) || [];
        var settings = (dash && dash.settings) || {};
        state.votingOpen = settings.voting_open !== undefined ? Boolean(settings.voting_open) : true;
        var subRaw = (state.activePoll && state.activePoll.voting_subtitle) || settings.voting_subtitle;
        state.votingSubtitle = formatCoverSubtitle(subRaw, state.projects.length, isSimpleMode());
        var voteEpoch = Number(settings.vote_epoch || 1);
        var activePollId = (state.activePoll && state.activePoll.id) || settings.active_poll_id || null;
        var cached = Store.getCachedVoteReceipt(voteEpoch, activePollId);
        if (cached && cached.project_id) {
          state.receipt = cached;
          state.step = 'receipt';
        } else {
          state.receipt = null;
          state.step = 'cover';
        }
      } catch (err) {
        state.error = (err && err.message) || 'Could not load voting options.';
        state.step = 'cover';
      } finally {
        state.loading = false;
        render();
      }
    }

    function renderFooter() {
      return (
        '<footer class="tepa-brand-footer">' +
        '  <img src="' + esc(assetUrl('totalenergies-logo.png')) + '" alt="TotalEnergies">' +
        '</footer>'
      );
    }

    function renderDemoVoteReset() {
      if (Store.getMode() !== 'demo') return '';
      return (
        '<div style="margin-top:10px;text-align:center;">' +
        '  <button type="button" class="tepa-stage-btn" data-action="sim-new-voter" style="font-size:11px;opacity:0.85;">' +
        '    Demo: Simulate New Employee Phone' +
        '  </button>' +
        '</div>'
      );
    }

    function syncSelectionInPlace() {
      var shell = root.querySelector('#tepa-vote-shell');
      if (!shell) return;
      shell.querySelectorAll('.tepa-project-row').forEach(function (row) {
        var id = Number(row.getAttribute('data-id'));
        var isSel = id === state.selectedProjectId;
        row.classList.toggle('is-selected', isSel);
        row.setAttribute('aria-checked', isSel ? 'true' : 'false');
      });
      var submitBtn = shell.querySelector('#tepa-vote-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = !(state.selectedProjectId && state.votingOpen);
      }
    }

    function syncModalInPlace() {
      var shell = root.querySelector('#tepa-vote-shell');
      if (!shell) return;
      var existing = shell.querySelector('#tepa-vote-modal-backdrop');
      var selectedProj = state.projects.find(function (p) { return p.id === state.selectedProjectId; });

      if (!state.confirmOpen || !selectedProj) {
        if (existing) existing.remove();
        return;
      }

      if (existing) {
        var confBtn = existing.querySelector('#tepa-vote-confirm-btn');
        if (confBtn) {
          confBtn.disabled = state.submitting;
          confBtn.textContent = state.submitting ? 'Recording Vote...' : 'Confirm My Vote';
        }
        return;
      }

      var isSimple = isSimpleMode();
      var catLine = selectedProj.category_name
        ? ('Category: <strong>' + esc(selectedProj.category_name) + '</strong><br>')
        : '';

      var wrap = document.createElement('div');
      wrap.className = 'tepa-modal-backdrop';
      wrap.id = 'tepa-vote-modal-backdrop';
      wrap.innerHTML =
        '<div class="tepa-modal-card">' +
        '  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#FFD239;font-weight:700;margin-bottom:6px;">Confirm Your Vote</div>' +
        '  <h2 style="margin:0 0 8px;font-size:20px;">' + esc(selectedProj.project_title) + '</h2>' +
        '  <p style="margin:0 0 18px;font-size:13px;color:#C7C9D9;line-height:1.45;">' +
        catLine +
        '    Each participant can submit only <strong>1 vote</strong>' + (isSimple ? ' in this poll.' : ' for Best of the Best.') +
        '  </p>' +
        '  <div style="display:flex;flex-direction:column;gap:10px;">' +
        '    <button type="button" class="tepa-btn-cta is-pill" id="tepa-vote-confirm-btn" data-action="confirm-vote" ' + (state.submitting ? 'disabled' : '') + '>' +
        (state.submitting ? 'Recording Vote...' : 'Confirm My Vote') +
        '    </button>' +
        '    <button type="button" class="tepa-btn-rainbow-outline is-pill" data-action="cancel-confirm">Change Selection</button>' +
        '  </div>' +
        '</div>';
      shell.appendChild(wrap);
    }

    function render(directionHint) {
      ensureShell();
      var shell = root.querySelector('#tepa-vote-shell');
      if (!shell) return;

      var stepChanged = state.lastStep !== state.step;
      var animCls = 'tepa-anim-enter';
      if (directionHint === 'prev') animCls = 'tepa-anim-slide-prev';
      else if (directionHint === 'next') animCls = 'tepa-anim-slide-next';
      state.lastStep = state.step;

      shell.setAttribute('data-player-step', state.step);
      shell.classList.toggle('is-scrollable', state.step === 'cover' || state.step === 'receipt');
      if (stepChanged) shell.scrollTop = 0;

      if (state.loading || state.step === 'loading') {
        shell.innerHTML =
          '<div class="tepa-mobile-content" style="align-items:center;justify-content:center;padding:32px;text-align:center;">' +
          '  <img class="tepa-lightup-logo" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">' +
          '  <p style="margin-top:18px;color:#C7C9D9;">Loading Voting System...</p>' +
          '</div>' + renderFooter();
        return;
      }

      var isSimple = isSimpleMode();

      if (state.step === 'cover') {
        shell.innerHTML =
          '<div class="tepa-vote-ambient-glow" style="background-image:url(\'' + esc(assetUrl('lightbulb-hero.jpg')) + '\');"></div>' +
          '<div class="tepa-vote-hero ' + (directionHint ? animCls : '') + '">' +
          '  <img src="' + esc(assetUrl('lightbulb-hero.jpg')) + '" alt="TEPA Performance Award">' +
          '</div>' +
          '<div class="tepa-cover-line-wrap"><div class="tepa-rainbow-line"></div></div>' +
          '<div class="tepa-vote-cover-body ' + (directionHint ? animCls : '') + '">' +
          '  <img class="tepa-lightup-logo" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">' +
          '  <h1 class="tepa-cover-title tepa-rainbow-text">Voting System</h1>' +
          '  <p class="tepa-cover-subtitle">' + state.votingSubtitle + '</p>' +
          (state.votingOpen
            ? ''
            : '<p style="margin:8px 0 0;padding:7px 14px;border-radius:10px;background:rgba(231,36,40,0.2);border:1px solid #E72428;font-size:12.5px;">Voting is currently closed.</p>') +
          '  <div class="tepa-cover-cta-wrap">' +
          '    <button type="button" class="tepa-btn-rainbow-outline" data-action="open-list" ' + (state.votingOpen ? '' : 'disabled') + '>Click to Select</button>' +
          '  </div>' +
          '</div>' +
          renderFooter();
      } else if (state.step === 'select') {
        var listHtml = state.projects.map(function (p, idx) {
          var isSel = state.selectedProjectId === p.id;
          var catHtml = (!isSimple && p.category_name)
            ? '<div class="tepa-project-cat">' + esc(pad2(p.slot_number)) + ' · ' + esc(p.category_name) + '</div>'
            : (p.category_name ? '<div class="tepa-project-cat">' + esc(p.category_name) + '</div>' : '');
          var teamHtml = (!isSimple && p.team_name)
            ? '<div class="tepa-project-team">' + esc(p.team_name) + '</div>'
            : '';
          return (
            '<button type="button" class="tepa-project-row ' + (isSel ? 'is-selected' : '') + '" style="--stagger:' + idx + ';" data-action="pick-project" data-id="' + p.id + '" role="radio" aria-checked="' + (isSel ? 'true' : 'false') + '">' +
            '  <div class="tepa-project-meta">' +
            catHtml +
            '    <div class="tepa-project-title">' + esc(p.project_title) + '</div>' +
            teamHtml +
            '  </div>' +
            '  <div class="tepa-radio-circle" aria-hidden="true"></div>' +
            '</button>'
          );
        }).join('');

        if (!state.projects.length) {
          listHtml = '<p style="text-align:center;color:#626476;padding:28px 16px;font-size:14px;">' + (isSimple ? 'No poll options available.' : 'No finalist projects available.') + '</p>';
        }

        var backIconSvg =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="9.5" stroke="white" stroke-width="1.8"/>' +
          '<path d="M13.2 8.5L9.7 12L13.2 15.5M10.2 12H15.8" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>';

        var countTier = state.projects.length <= 4 ? 'few' : (state.projects.length <= 6 ? 'medium' : 'full');

        shell.innerHTML =
          '<header class="tepa-sheet-header tepa-anim-enter">' +
          '  <h1 class="tepa-rainbow-text">Voting System</h1>' +
          '  <button type="button" class="tepa-btn-rainbow-outline is-pill" data-action="back-cover">' + backIconSvg + '<span>Back</span></button>' +
          '</header>' +
          '<main class="tepa-sheet-body tepa-anim-sheet">' +
          '  <div class="tepa-sheet-toolbar">' +
          '    <span class="tepa-cat-pill">' + (isSimple ? 'Options' : 'Categories') + '</span>' +
          '  </div>' +
          '  <div class="tepa-project-list" data-count-tier="' + countTier + '" role="radiogroup" aria-label="Voting Options">' +
          listHtml +
          '  </div>' +
          '  <div class="tepa-sheet-sticky-footer">' +
          (state.error ? '<p style="color:#E72428;font-size:12.5px;margin:0 0 4px;">' + esc(state.error) + '</p>' : '') +
          '    <button type="button" id="tepa-vote-submit-btn" class="tepa-btn-cta is-pill" data-action="open-confirm" ' + (state.selectedProjectId && state.votingOpen ? '' : 'disabled') + '>Submit Vote</button>' +
          '  </div>' +
          '</main>';

        syncModalInPlace();
      } else if (state.step === 'receipt' && state.receipt) {
        var votedProj = state.projects.find(function (p) { return p.id === state.receipt.project_id; });
        var quizUrl = Store.getConfig().quizUrl || 'quiz.html';
        var pollLabel = (state.activePoll && state.activePoll.title) || 'TEPA Performance Award 2026';
        var receiptCat = votedProj && votedProj.category_name
          ? '<div style="font-size:12px;color:#FFD239;font-weight:700;text-transform:uppercase;margin-top:4px;">' + esc(pad2(votedProj.slot_number)) + ' · ' + esc(votedProj.category_name) + '</div>'
          : '';
        shell.innerHTML =
          '<div class="tepa-bulb-watermark" style="background-image:url(\'' + esc(assetUrl('lightbulb-hero.jpg')) + '\');"></div>' +
          '<div class="tepa-mobile-content ' + animCls + '">' +
          '  <div class="tepa-quiz-step-wrap is-receipt">' +
          '    <img class="tepa-lightup-logo is-sm" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">' +
          '    <h1 class="tepa-step-heading tepa-rainbow-text" style="margin-top:20px;">Vote Recorded!</h1>' +
          '    <p class="tepa-step-sub">' + (isSimple ? ('Thank you for participating in ' + esc(pollLabel) + '.') : 'Thank you for voting in the TEPA Performance Award 2026.') + '</p>' +
          '    <div class="tepa-voucher-card" style="text-align:center;">' +
          '      <div class="tepa-voucher-badge">' + (isSimple ? '✓ Vote Confirmed' : '✓ Best of the Best Vote') + '</div>' +
          (votedProj
            ? receiptCat +
              '<h2 style="margin:6px 0 6px;font-size:20px;">' + esc(votedProj.project_title) + '</h2>' +
              ((!isSimple && votedProj.team_name) ? '<div style="font-size:12.5px;color:#C7C9D9;">' + esc(votedProj.team_name) + '</div>' : '')
            : '<h2 style="margin:6px 0;">Option #' + esc(state.receipt.project_id) + '</h2>') +
          '      <p style="margin:12px 0 2px;font-size:12.5px;color:#C7C9D9;">Live bars are updating on the Auditorium Screen</p>' +
          '    </div>' +
          '    <div style="width:100%;display:flex;flex-direction:column;gap:10px;margin-top:6px;">' +
          '      <a href="' + esc(quizUrl) + '" class="tepa-btn-rainbow-outline is-pill" style="width:100%;">Go to Welcome Quiz</a>' +
          renderDemoVoteReset() +
          '    </div>' +
          '  </div>' +
          '</div>' +
          renderFooter();
      }
    }

    root.addEventListener('click', async function (ev) {
      if (!ev.target || !ev.target.closest) return;
      var btn = ev.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');

      if (action === 'open-list') {
        state.step = 'select';
        state.error = '';
        render('next');
      } else if (action === 'back-cover') {
        state.step = 'cover';
        state.confirmOpen = false;
        state.error = '';
        render('prev');
      } else if (action === 'pick-project') {
        state.selectedProjectId = Number(btn.getAttribute('data-id'));
        state.error = '';
        syncSelectionInPlace();
      } else if (action === 'open-confirm') {
        if (state.selectedProjectId) {
          state.confirmOpen = true;
          syncModalInPlace();
        }
      } else if (action === 'cancel-confirm') {
        state.confirmOpen = false;
        syncModalInPlace();
      } else if (action === 'confirm-vote') {
        state.submitting = true;
        state.error = '';
        syncModalInPlace();
        try {
          var res = await Store.submitProjectVote(state.selectedProjectId);
          if (!res || !res.ok) {
            state.error = (res && res.error) || 'Could not submit your vote.';
            state.confirmOpen = false;
            state.submitting = false;
            render();
            return;
          }
          state.receipt = res;
          state.confirmOpen = false;
          state.step = 'receipt';
        } catch (err) {
          state.error = (err && err.message) || 'Network error while voting.';
          state.confirmOpen = false;
        } finally {
          state.submitting = false;
          render('next');
        }
      } else if (action === 'sim-new-voter') {
        Store.rotateSimulatedDeviceId();
        state.step = 'loading';
        state.lastStep = null;
        state.selectedProjectId = null;
        state.confirmOpen = false;
        state.receipt = null;
        state.error = '';
        await load();
      }
    });

    load();
  }

  // =========================================================================
  // 3. AUDITORIUM 16:9 LIVE STAGE SCREEN — Mentimeter-Inspired ([data-tepa-app="live"])
  // =========================================================================

  function mountLiveApp(root) {
    var THEME_KEY = 'tepa_live_theme_v1';
    var MENTI_PALETTE = [
      '#4E6AF5', '#FF6B6B', '#283272', '#F77B39', '#2194D4',
      '#64BD75', '#8F4F9E', '#E72428', '#F4B400', '#00A396',
      '#6C5CE7', '#FF8A5B', '#2E86DE', '#20BF6B', '#D980FA'
    ];

    var urlParams = new URLSearchParams(global.location ? global.location.search : '');
    var initialChart = urlParams.get('chart') === 'vertical' ? 'vertical' : 'horizontal';
    var savedTheme = 'light';
    try {
      var stTheme = global.localStorage.getItem(THEME_KEY);
      if (stTheme === 'dark' || stTheme === 'light') savedTheme = stTheme;
    } catch (e) {}

    var state = {
      dash: null,
      localStageOverride: null,
      theme: savedTheme, // 'light' | 'dark'
      chartType: initialChart, // 'horizontal' (Ref 2) | 'vertical' (Ref 1)
      verticalScope: 'top5', // 'top5' | 'all15'
      hideResults: false,
      sortMode: 'votes', // 'votes' | 'slot'
      showQrSidebar: true,
      loading: true,
      lastRenderKey: null
    };
    var unsubscribe = null;
    var safetyPoll = null;
    var refreshInFlight = false;
    var refreshQueued = false;
    var prevServerStage = null;
    var prevQuizReveal = null;
    var prevRemoteSig = null;

    function colorFor(project) {
      var idx = Math.max(0, Number(project.slot_number || project.id || 1) - 1);
      return MENTI_PALETTE[idx % MENTI_PALETTE.length];
    }

    function shortHostLabel(targetUrl) {
      try {
        var u = new URL(targetUrl);
        var path = u.pathname.replace(/\/+$/, '');
        return u.host + (path && path !== '/' ? path : '');
      } catch (e) {
        return 'tepa-award';
      }
    }

    async function refresh() {
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }
      refreshInFlight = true;
      try {
        var nextDash = await Store.getDashboardState();
        var s = (nextDash && nextDash.settings) || {};
        var nextServerStage = s.reveal_winner ? 'winner_reveal' : (s.stage_mode || 'live_voting');
        var nextQuizReveal = Boolean(s.reveal_quiz_winners);
        var remoteSig = [
          s.live_theme || 'light',
          s.live_chart_type || 'horizontal',
          s.live_vertical_scope || 'top5',
          s.live_sort_mode || 'votes',
          s.live_show_qr !== false ? '1' : '0',
          s.live_hide_results ? '1' : '0'
        ].join('|');

        if (prevServerStage && prevServerStage !== nextServerStage) {
          state.localStageOverride = null;
        }
        if (prevQuizReveal !== null && prevQuizReveal !== nextQuizReveal && nextQuizReveal) {
          state.localStageOverride = null;
        }
        if (prevRemoteSig !== remoteSig) {
          if (s.live_theme === 'dark' || s.live_theme === 'light') {
            state.theme = s.live_theme;
            try { global.localStorage.setItem(THEME_KEY, state.theme); } catch (e) {}
          }
          if (s.live_chart_type === 'vertical' || s.live_chart_type === 'horizontal') {
            state.chartType = s.live_chart_type;
          }
          if (s.live_vertical_scope === 'top5' || s.live_vertical_scope === 'all15') {
            state.verticalScope = s.live_vertical_scope;
          }
          if (s.live_sort_mode === 'votes' || s.live_sort_mode === 'slot') {
            state.sortMode = s.live_sort_mode;
          }
          if (s.live_show_qr !== undefined && s.live_show_qr !== null) {
            state.showQrSidebar = Boolean(s.live_show_qr);
          }
          if (s.live_hide_results !== undefined && s.live_hide_results !== null) {
            state.hideResults = Boolean(s.live_hide_results);
          }
          prevRemoteSig = remoteSig;
        }
        prevServerStage = nextServerStage;
        prevQuizReveal = nextQuizReveal;
        state.dash = nextDash;
      } catch (e) {
      } finally {
        refreshInFlight = false;
        state.loading = false;
        render();
        if (refreshQueued) {
          refreshQueued = false;
          refresh();
        }
      }
    }

    function currentStageMode() {
      if (state.localStageOverride) return state.localStageOverride;
      if (state.dash && state.dash.settings && state.dash.settings.reveal_winner) return 'winner_reveal';
      return (state.dash && state.dash.settings && state.dash.settings.stage_mode) || 'live_voting';
    }

    function getHDensity(n) {
      return n <= 4 ? 'xl' : (n <= 7 ? 'lg' : (n <= 11 ? 'md' : 'sm'));
    }

    function getVDensity(n) {
      return n <= 3 ? 'xl' : (n <= 6 ? 'lg' : (n <= 10 ? 'md' : 'sm'));
    }

    function formatStageCat(p) {
      return (p && p.category_name) ? (pad2(p.slot_number) + ' · ' + p.category_name) : '';
    }

    function updateHorizontalInPlace(ranked, displayList, totalVotes, maxVotes) {
      var listEl = root.querySelector('.tepa-menti-hlist');
      if (!listEl) return false;
      var nodes = {};
      listEl.querySelectorAll('[data-project-id]').forEach(function (el) {
        nodes[el.getAttribute('data-project-id')] = el;
      });
      if (Object.keys(nodes).length !== displayList.length) return false;

      var orderedRows = [];
      displayList.forEach(function (p, idx) {
        var row = nodes[String(p.id)];
        if (!row) return;
        orderedRows.push(row);
        var v = Number(p.votes || 0);
        var sharePct = (!state.hideResults && totalVotes > 0) ? Math.round((v / totalVotes) * 100) : 0;
        var isZero = !state.hideResults && v === 0;
        var barPct = isZero ? 0 : ((!state.hideResults && maxVotes > 0 && v > 0) ? Math.max(2.5, (v / maxVotes) * 100) : 1);
        var barPctStr = isZero ? '0' : barPct.toFixed(2);

        var rankEl = row.querySelector('.tepa-menti-hrank');
        if (rankEl) rankEl.textContent = (idx + 1) + '.';
        var titleEl = row.querySelector('.tepa-menti-htitle');
        if (titleEl && titleEl.textContent !== p.project_title) titleEl.textContent = p.project_title;
        var catEl = row.querySelector('.tepa-menti-hcat');
        var nextCat = formatStageCat(p);
        if (catEl && catEl.textContent !== nextCat) catEl.textContent = nextCat;

        var numEl = row.querySelector('.tepa-hnum');
        var pctEl = row.querySelector('.tepa-menti-hpct');
        if (numEl) {
          if (state.hideResults) numEl.textContent = '••';
          else animateNumber(numEl, v, function (n) { return String(Math.round(n)); }, 380);
        }
        if (pctEl) {
          if (state.hideResults) pctEl.textContent = '';
          else animateNumber(pctEl, sharePct, function (n) { return '(' + Math.round(n) + '%)'; }, 380);
        }

        var fillEl = row.querySelector('.tepa-menti-hfill');
        if (fillEl) {
          fillEl.classList.toggle('is-zero', isZero);
          fillEl.style.transitionDelay = '0ms';
          fillEl.style.backgroundColor = colorFor(p);
          if (fillEl.getAttribute('data-target-pct') !== barPctStr) {
            fillEl.setAttribute('data-target-pct', barPctStr);
            fillEl.style.width = barPctStr + '%';
          }
        }
      });

      if (orderedRows.length === displayList.length) {
        flipReorderChildren(listEl, orderedRows);
      }

      var waitEl = root.querySelector('#tepa-menti-wait-text');
      if (waitEl) {
        waitEl.textContent = totalVotes === 0
          ? 'Waiting for participants'
          : totalVotes + (totalVotes === 1 ? ' vote received' : ' votes received');
      }
      var countPill = root.querySelector('#tepa-menti-total-pill');
      if (countPill) animateNumber(countPill, totalVotes, function (n) { return String(Math.round(n)); }, 380);
      return true;
    }

    function updateVerticalInPlace(visibleCols, totalVotes, maxVotes) {
      var barsWrap = root.querySelector('.tepa-menti-vbars');
      var labelsWrap = root.querySelector('.tepa-menti-vlabels');
      if (!barsWrap || !labelsWrap) return false;

      var existingCols = Array.from(barsWrap.querySelectorAll('[data-project-id]'));
      var existingLbls = Array.from(labelsWrap.querySelectorAll('[data-label-id]'));
      if (existingCols.length !== visibleCols.length || existingLbls.length !== visibleCols.length) return false;

      var colNodes = {};
      var lblNodes = {};
      existingCols.forEach(function (el) { colNodes[el.getAttribute('data-project-id')] = el; });
      existingLbls.forEach(function (el) { lblNodes[el.getAttribute('data-label-id')] = el; });

      var wantedIds = {};
      visibleCols.forEach(function (p) { wantedIds[String(p.id)] = true; });
      var spareCols = existingCols.filter(function (el) { return !wantedIds[el.getAttribute('data-project-id')]; });
      var spareLbls = existingLbls.filter(function (el) { return !wantedIds[el.getAttribute('data-label-id')]; });

      var orderedCols = [];
      var orderedLbls = [];
      visibleCols.forEach(function (p) {
        var pidStr = String(p.id);
        var col = colNodes[pidStr];
        var lbl = lblNodes[pidStr];
        var repurposed = false;
        if ((!col || !lbl) && spareCols.length && spareLbls.length) {
          col = spareCols.shift();
          lbl = spareLbls.shift();
          col.setAttribute('data-project-id', pidStr);
          lbl.setAttribute('data-label-id', pidStr);
          repurposed = true;
        }
        if (!col || !lbl) return;

        orderedCols.push(col);
        orderedLbls.push(lbl);
        var v = Number(p.votes || 0);
        var sharePct = (!state.hideResults && totalVotes > 0) ? Math.round((v / totalVotes) * 100) : 0;
        var barH = (!state.hideResults && maxVotes > 0 && v > 0) ? Math.max(4, (v / maxVotes) * 82) : 3;
        var barHStr = barH.toFixed(2);

        if (repurposed && lbl.children.length >= 2) {
          lbl.children[0].textContent = p.project_title;
          lbl.children[1].textContent = formatStageCat(p);
        }

        var numEl = col.querySelector('.tepa-vnum');
        var pctEl = col.querySelector('.tepa-menti-vcount-pct');
        if (numEl) {
          if (repurposed) numEl._tepaNumVal = v;
          if (state.hideResults) numEl.textContent = '•';
          else animateNumber(numEl, v, function (n) { return String(Math.round(n)); }, 380);
        }
        if (pctEl) {
          if (repurposed) pctEl._tepaNumVal = sharePct;
          if (state.hideResults) pctEl.textContent = '';
          else animateNumber(pctEl, sharePct, function (n) { return Math.round(n) + '%'; }, 380);
        }

        var barEl = col.querySelector('.tepa-menti-vbar');
        if (barEl) {
          barEl.style.transitionDelay = '0ms';
          barEl.style.backgroundColor = colorFor(p);
          if (barEl.getAttribute('data-target-pct') !== barHStr) {
            barEl.setAttribute('data-target-pct', barHStr);
            barEl.style.height = barHStr + '%';
          }
        }
      });

      if (orderedCols.length === visibleCols.length) {
        flipReorderChildren(barsWrap, orderedCols);
        flipReorderChildren(labelsWrap, orderedLbls);
      }

      var waitEl = root.querySelector('#tepa-menti-wait-text');
      if (waitEl) {
        waitEl.textContent = totalVotes === 0
          ? 'Waiting for participants'
          : totalVotes + (totalVotes === 1 ? ' vote received' : ' votes received');
      }
      var countPill = root.querySelector('#tepa-menti-total-pill');
      if (countPill) animateNumber(countPill, totalVotes, function (n) { return String(Math.round(n)); }, 380);
      return true;
    }

    function updateQuizQrInPlace(qs, quizWinnersRevealed, totalVotes) {
      var partEl = root.querySelector('#tepa-quiz-stage-participants');
      if (!partEl) return false;
      animateNumber(partEl, Number(qs.total_participants || 0), function (n) { return String(Math.round(n)); }, 380);
      var vouchEl = root.querySelector('#tepa-quiz-stage-vouchers');
      if (vouchEl) {
        vouchEl.textContent = quizWinnersRevealed
          ? ((qs.vouchers_awarded || 0) + ' / ' + (qs.max_vouchers || 10))
          : ('Top ' + (qs.max_vouchers || 10));
      }
      var countPill = root.querySelector('#tepa-menti-total-pill');
      if (countPill) animateNumber(countPill, totalVotes, function (n) { return String(Math.round(n)); }, 380);
      return true;
    }

    function updateWinnerRevealInPlace(topWinner, runners, totalVotes) {
      var votesEl = root.querySelector('#tepa-reveal-votes');
      var pctEl = root.querySelector('#tepa-reveal-pct');
      if (topWinner && totalVotes > 0 && votesEl && pctEl) {
        var topVotes = Number(topWinner.votes || 0);
        var topShare = Math.round((topVotes / totalVotes) * 100);
        animateNumber(votesEl, topVotes, function (n) { return String(Math.round(n)); }, 380);
        animateNumber(pctEl, topShare, function (n) { return Math.round(n) + '%'; }, 380);
        (runners || []).forEach(function (rn, idx) {
          var rEl = root.querySelector('[data-runner-idx="' + idx + '"]');
          if (rEl) {
            var rVotes = Number(rn.votes || 0);
            var rPct = Math.round((rVotes / totalVotes) * 100);
            rEl.textContent = rVotes + ' votes (' + rPct + '%)';
          }
        });
      }
      var countPill = root.querySelector('#tepa-menti-total-pill');
      if (countPill) animateNumber(countPill, totalVotes, function (n) { return String(Math.round(n)); }, 380);
      return Boolean(root.querySelector('.tepa-menti-spotlight'));
    }

    function render() {
      if (state.loading || !state.dash) {
        root.innerHTML =
          '<div class="tepa-menti-stage" data-live-theme="' + esc(state.theme) + '" style="align-items:center;justify-content:center;">' +
          '  <img src="' + esc(assetUrl('totalenergies-logo.png')) + '" alt="TotalEnergies" style="height:64px;">' +
          '  <p style="color:var(--m-muted);margin-top:14px;">Loading Live Stage...</p>' +
          '</div>';
        state.lastRenderKey = null;
        return;
      }

      var mode = Store.getMode();
      var dash = state.dash;
      var settings = dash.settings || {};
      var activeQuiz = dash.active_quiz || null;
      var activePoll = dash.active_poll || null;
      var isSimplePoll = Boolean(activePoll && activePoll.poll_type === 'simple');
      var stageMode = currentStageMode();
      var cfg = Store.getConfig();
      var quizTargetUrl = absUrl(cfg.quizUrl || 'quiz.html');
      var voteTargetUrl = absUrl(cfg.voteUrl || 'vote.html');

      var projects = (dash.projects_with_votes || []).slice();
      var totalVotes = projects.reduce(function (acc, p) { return acc + (Number(p.votes) || 0); }, 0);
      var maxVotes = projects.reduce(function (acc, p) { return Math.max(acc, p.votes || 0); }, 0);

      var ranked = projects.slice().sort(function (a, b) {
        if ((b.votes || 0) !== (a.votes || 0)) return (b.votes || 0) - (a.votes || 0);
        return (a.sort_order || a.slot_number) - (b.sort_order || b.slot_number);
      });

      var displayList = state.sortMode === 'votes'
        ? ranked
        : projects.slice().sort(function (a, b) {
            return (a.sort_order || a.slot_number) - (b.sort_order || b.slot_number);
          });

      var visibleCols = (state.chartType === 'vertical' && state.verticalScope === 'top5' && projects.length > 5)
        ? ranked.slice(0, 5)
        : displayList;

      var qsForKey = dash.quiz_stats || {};
      var winnersSig = (qsForKey.winners || []).map(function (w) {
        return (w.winner_rank || '') + ':' + (w.code_suffix || '');
      }).join(',');
      var projectsMetaSig = projects.map(function (p) {
        return p.id + ':' + (p.slot_number || 0) + ':' + (p.project_title || '') + ':' + (p.category_name || '');
      }).join(';');
      var topWinnerForKey = ranked[0] || {};
      var effHeadline = (activePoll && activePoll.voting_headline) || settings.voting_headline || '';
      var quizWinnersRevealedForKey = Boolean(settings.reveal_quiz_winners || qsForKey.reveal_quiz_winners);
      var runnerIdsSig = ranked.slice(1, 4).map(function (r) { return r.id; }).join(',');
      var renderKey = [
        stageMode, state.theme, state.chartType, state.verticalScope,
        state.showQrSidebar, state.hideResults, state.sortMode, mode,
        (activePoll && activePoll.id) || '', (activePoll && activePoll.poll_type) || 'projects',
        (activePoll && activePoll.title) || '',
        projects.length, projectsMetaSig, effHeadline, settings.event_title || '',
        (activeQuiz && activeQuiz.title) || '', (activeQuiz && activeQuiz.voucher_title) || '',
        stageMode === 'quiz_qr'
          ? (quizWinnersRevealedForKey + ':' + (qsForKey.max_vouchers || 10) + ':' + (quizWinnersRevealedForKey ? winnersSig : ''))
          : '',
        stageMode === 'winner_reveal'
          ? ((totalVotes > 0 ? '1' : '0') + ':' + (topWinnerForKey.id || 0) + ':' + runnerIdsSig)
          : ''
      ].join('|');

      var existingStageEl = root.querySelector('.tepa-menti-stage');
      if (existingStageEl && state.lastRenderKey === renderKey) {
        if (stageMode === 'live_voting') {
          var updated = state.chartType === 'horizontal'
            ? updateHorizontalInPlace(ranked, displayList, totalVotes, maxVotes)
            : updateVerticalInPlace(visibleCols, totalVotes, maxVotes);
          if (updated) return;
        } else if (stageMode === 'quiz_qr') {
          if (updateQuizQrInPlace(qsForKey, quizWinnersRevealedForKey, totalVotes)) return;
        } else if (stageMode === 'winner_reveal') {
          if (updateWinnerRevealInPlace(ranked[0], ranked.slice(1, 4), totalVotes)) return;
        }
      }

      var prevKey = state.lastRenderKey;
      state.lastRenderKey = renderKey;

      var fsIcon =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
      var sortIcon =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 6h13M3 12h9M3 18h5M18 8v10M15 15l3 3 3-3"/></svg>';
      var hChartIcon =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
        '<path d="M4 6h16M4 12h11M4 18h7"/></svg>';
      var vChartIcon =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
        '<path d="M6 20V10M12 20V4M18 20v-7"/></svg>';
      var qrIcon =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h1"/></svg>';
      var eyeIcon =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      var bulbIcon =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>';

      var topBar =
        '<header class="tepa-menti-topbar">' +
        '  <div class="tepa-menti-top-actions">' +
        '    <button type="button" class="tepa-menti-icon-circle" data-action="fullscreen" title="Fullscreen">' + fsIcon + '</button>' +
        (stageMode === 'live_voting'
          ? '<button type="button" class="tepa-menti-icon-circle" data-action="toggle-sort" title="Sort: ' + (state.sortMode === 'votes' ? 'Top Votes' : 'Order') + '">' + sortIcon + '</button>'
          : '') +
        '  </div>' +
        '  <div class="tepa-menti-brand-right">' +
        '    <div class="tepa-menti-lu-wrap"><img class="tepa-menti-lu-logo" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP"></div>' +
        '    <div class="tepa-menti-te-wrap"><img class="tepa-menti-te-logo" src="' + esc(assetUrl('totalenergies-logo.png')) + '" alt="TotalEnergies"></div>' +
        '  </div>' +
        '</header>';

      var headlineTitle = stageMode === 'quiz_qr'
        ? esc((activeQuiz && activeQuiz.title && activeQuiz.title !== 'Quiz' ? activeQuiz.title : 'Welcome Quiz') + ' — Scan to Join & Win!')
        : (stageMode === 'winner_reveal'
          ? esc(isSimplePoll ? (effHeadline || (activePoll && activePoll.title) || 'Poll Results') : ((settings.event_title || 'TEPA Performance Award 2026') + ' — Best of the Best'))
          : esc(effHeadline || 'Which finalist project deserves the Best of the Best?'));

      var headlineRow =
        '<div class="tepa-menti-headline-row tepa-anim-enter">' +
        '  <h1 class="tepa-menti-headline">' + headlineTitle + '</h1>' +
        (stageMode === 'live_voting' && state.chartType === 'vertical' && projects.length > 5
          ? '<div class="tepa-menti-sub-toggle">' +
            '  <button type="button" class="tepa-menti-sub-btn ' + (state.verticalScope === 'top5' ? 'is-active' : '') + '" data-vscope="top5">Top 5</button>' +
            '  <button type="button" class="tepa-menti-sub-btn ' + (state.verticalScope === 'all15' ? 'is-active' : '') + '" data-vscope="all15">All ' + projects.length + '</button>' +
            '</div>'
          : '') +
        '</div>';

      var workspaceHtml = '';

      if (stageMode === 'quiz_qr') {
        var qs = dash.quiz_stats || { total_participants: 0, vouchers_awarded: 0, max_vouchers: 10, winners: [] };
        var prizeTitle = (activeQuiz && activeQuiz.voucher_title) || 'Café Bonjour Breakfast Voucher';
        var quizWinnersRevealed = Boolean(settings.reveal_quiz_winners || qs.reveal_quiz_winners);
        var winnersHtml = '';
        if (quizWinnersRevealed) {
          winnersHtml = (qs.winners || []).map(function (w, i) {
            return (
              '<div class="tepa-winner-chip tepa-anim-enter" style="animation-delay:' + (i * 45) + 'ms;">' +
              '  <div><strong style="color:#F77B39;">#' + esc(w.winner_rank) + '</strong> ' + esc(w.display_name) + '</div>' +
              '  <span style="font-size:12px;color:var(--m-muted);font-family:monospace;">****' + esc(w.code_suffix) + '</span>' +
              '</div>'
            );
          }).join('');
          if (!winnersHtml) {
            winnersHtml = '<p style="color:var(--m-muted);font-size:14px;">No qualifying winners recorded in this round yet.</p>';
          }
        } else {
          winnersHtml =
            '<div class="tepa-anim-enter" style="padding:20px 22px;border-radius:16px;background:var(--m-bg);border:1px dashed var(--m-border);display:flex;align-items:center;gap:14px;">' +
            '  <div style="width:42px;height:42px;border-radius:12px;background:rgba(247,123,57,0.14);color:#F77B39;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
            '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            '  </div>' +
            '  <div>' +
            '    <div style="font-weight:700;font-size:15px;color:var(--m-text);margin-bottom:3px;">Official Winners Announcement Pending</div>' +
            '    <div style="font-size:13px;color:var(--m-muted);line-height:1.45;">Scan the QR code to complete the Quiz and keep your <strong>Unique Participant ID</strong>. The event manager will announce the ' + esc(prizeTitle) + ' winners right here on the live screen!</div>' +
            '  </div>' +
            '</div>';
        }
        workspaceHtml =
          '<div class="tepa-menti-quiz-grid tepa-anim-enter">' +
          '  <div class="tepa-menti-qrcard">' +
          '    <div class="tepa-menti-qrwrap" style="max-width:260px;" id="tepa-stage-quiz-qr"></div>' +
          '    <div class="tepa-menti-qrsub">Scan QR to join Quiz</div>' +
          '    <div class="tepa-menti-qrhost">' + esc(shortHostLabel(quizTargetUrl)) + '</div>' +
          '  </div>' +
          '  <div style="min-width:0;">' +
          '    <div class="tepa-menti-kpi-row">' +
          '      <div class="tepa-menti-kpi"><div class="tepa-menti-kpi-val" id="tepa-quiz-stage-participants">' + esc(qs.total_participants) + '</div><div class="tepa-menti-kpi-lbl">Participants</div></div>' +
          '      <div class="tepa-menti-kpi"><div class="tepa-menti-kpi-val" id="tepa-quiz-stage-vouchers" style="color:#F77B39;">' + (quizWinnersRevealed ? (esc(qs.vouchers_awarded) + ' / ' + esc(qs.max_vouchers)) : ('Top ' + esc(qs.max_vouchers))) + '</div><div class="tepa-menti-kpi-lbl">' + (quizWinnersRevealed ? 'Winners Announced' : 'Prizes Available') + '</div></div>' +
          '    </div>' +
          '    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;">' +
          '      <h3 style="margin:0;font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:var(--m-muted);">' + esc(prizeTitle) + ' Winners</h3>' +
          (quizWinnersRevealed
            ? '<span style="font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:999px;background:rgba(22,163,74,0.14);color:#16A34A;">● Official Results Live</span>'
            : '<span style="font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:999px;background:rgba(247,123,57,0.14);color:#F77B39;">Awaiting Manager Reveal</span>') +
          '    </div>' +
          '    <div class="tepa-winners-feed">' + winnersHtml + '</div>' +
          '  </div>' +
          '</div>';
      } else if (stageMode === 'winner_reveal') {
        var topWinner = ranked[0];
        var runners = ranked.slice(1, 4);
        var pctWin = totalVotes > 0 && topWinner ? Math.round((topWinner.votes / totalVotes) * 100) : 0;

        workspaceHtml =
          '<div class="tepa-menti-spotlight tepa-anim-enter">' +
          '  <div class="tepa-voucher-badge" style="font-size:13px;padding:7px 18px;">★ ' + (isSimplePoll ? esc((activePoll && activePoll.title) || 'Live Poll Results') : esc(settings.event_title || 'TEPA Performance Award 2026')) + '</div>' +
          '  <h2 class="tepa-rainbow-text" style="font-size:clamp(38px, 4.4vw, 60px);font-weight:800;margin:8px 0 12px;letter-spacing:-0.025em;">' + (isSimplePoll ? 'WINNING CHOICE' : 'BEST OF THE BEST') + '</h2>' +
          (topWinner && totalVotes > 0
            ? (topWinner.category_name
                ? '<div style="font-size:15px;color:#F77B39;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Category ' + esc(pad2(topWinner.slot_number)) + ' · ' + esc(topWinner.category_name) + '</div>'
                : '') +
              '<div style="font-size:clamp(26px, 3vw, 42px);font-weight:700;margin:8px 0 6px;">' + esc(topWinner.project_title) + '</div>' +
              ((!isSimplePoll && topWinner.team_name)
                ? '<div style="font-size:16px;color:var(--m-muted);margin-bottom:18px;">Team: ' + esc(topWinner.team_name) + '</div>'
                : '<div style="margin-bottom:14px;"></div>') +
              '<div style="display:inline-flex;gap:18px;padding:12px 24px;border-radius:999px;background:var(--m-bg);border:1px solid var(--m-border);">' +
              '  <span><strong id="tepa-reveal-votes" style="font-size:24px;">' + esc(topWinner.votes) + '</strong> votes</span>' +
              '  <span>·</span>' +
              '  <span><strong id="tepa-reveal-pct" style="font-size:24px;color:#4E6AF5;">' + pctWin + '%</strong> share</span>' +
              '</div>'
            : '<p style="color:var(--m-muted);font-size:16px;">No votes recorded yet — waiting for participants.</p>') +
          (runners.length && totalVotes > 0
            ? '<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:26px;width:100%;max-width:880px;">' +
              runners.map(function (rn, idx) {
                var rPct = totalVotes > 0 ? Math.round((rn.votes / totalVotes) * 100) : 0;
                return (
                  '<div class="tepa-anim-enter" style="animation-delay:' + ((idx + 1) * 90) + 'ms;flex:1;min-width:210px;background:var(--m-bg);border:1px solid var(--m-border);border-radius:16px;padding:14px 16px;text-align:left;">' +
                  '  <div style="font-size:11.5px;color:var(--m-muted);font-weight:600;">#' + (idx + 2) + (rn.category_name ? (' · ' + esc(rn.category_name)) : '') + '</div>' +
                  '  <div style="font-size:15px;font-weight:600;margin:4px 0;">' + esc(rn.project_title) + '</div>' +
                  '  <div style="font-size:13px;color:#F77B39;font-weight:600;" data-runner-idx="' + idx + '">' + esc(rn.votes) + ' votes (' + rPct + '%)</div>' +
                  '</div>'
                );
              }).join('') +
              '</div>'
            : '') +
          '</div>';
      } else {
        var chartHtml = '';
        if (state.chartType === 'vertical') {
          var colsCount = visibleCols.length || 5;
          var vColsHtml = visibleCols.map(function (p) {
            var v = Number(p.votes || 0);
            var sharePct = (!state.hideResults && totalVotes > 0) ? Math.round((v / totalVotes) * 100) : 0;
            var barH = (!state.hideResults && maxVotes > 0 && v > 0) ? Math.max(4, (v / maxVotes) * 82) : 3;
            var barHStr = barH.toFixed(2);
            return (
              '<div class="tepa-menti-vcol" data-project-id="' + p.id + '">' +
              '  <div class="tepa-menti-vcount"><span class="tepa-vnum">' + (state.hideResults ? '•' : v) + '</span>' + (state.hideResults ? '' : '<span class="tepa-menti-vcount-pct">' + sharePct + '%</span>') + '</div>' +
              '  <div class="tepa-menti-vbar" data-target-pct="' + barHStr + '" style="height:' + barHStr + '%;background-color:' + colorFor(p) + ';"></div>' +
              '</div>'
            );
          }).join('');
          var vLabelsHtml = visibleCols.map(function (p) {
            return (
              '<div class="tepa-menti-vlabel" data-label-id="' + p.id + '">' +
              '  <span>' + esc(p.project_title) + '</span>' +
              '  <span class="tepa-menti-vcat">' + esc(formatStageCat(p)) + '</span>' +
              '</div>'
            );
          }).join('');

          var vDensity = getVDensity(colsCount);
          var vConstrained = colsCount <= 4 ? '1' : '0';

          chartHtml =
            '<section class="tepa-menti-vchart tepa-anim-enter ' + (colsCount > 10 ? 'is-15' : '') + '" data-v-density="' + vDensity + '" data-v-constrained="' + vConstrained + '" style="--m-cols:' + colsCount + ';">' +
            '  <div class="tepa-menti-vbars">' + vColsHtml + '</div>' +
            '  <div class="tepa-menti-vlabels">' + vLabelsHtml + '</div>' +
            '</section>';
        } else {
          var hRowsHtml = displayList.map(function (p, idx) {
            var v = Number(p.votes || 0);
            var sharePct = (!state.hideResults && totalVotes > 0) ? Math.round((v / totalVotes) * 100) : 0;
            var isZero = !state.hideResults && v === 0;
            var barPct = isZero ? 0 : ((!state.hideResults && maxVotes > 0 && v > 0) ? Math.max(2.5, (v / maxVotes) * 100) : 1);
            var barPctStr = isZero ? '0' : barPct.toFixed(2);
            return (
              '<div class="tepa-menti-hrow" data-project-id="' + p.id + '">' +
              '  <div class="tepa-menti-hrank">' + (idx + 1) + '.</div>' +
              '  <div class="tepa-menti-hbar-col">' +
              '    <div class="tepa-menti-hmeta">' +
              '      <div class="tepa-menti-htitle-wrap">' +
              '        <span class="tepa-menti-htitle">' + esc(p.project_title) + '</span>' +
              '        <span class="tepa-menti-hcat">' + esc(formatStageCat(p)) + '</span>' +
              '      </div>' +
              '      <span class="tepa-menti-hvotes"><span class="tepa-hnum">' + (state.hideResults ? '••' : v) + '</span>' + (state.hideResults ? '' : '<span class="tepa-menti-hpct">(' + sharePct + '%)</span>') + '</span>' +
              '    </div>' +
              '    <div class="tepa-menti-htrack">' +
              '      <div class="tepa-menti-hfill' + (isZero ? ' is-zero' : '') + '" data-target-pct="' + barPctStr + '" style="width:' + barPctStr + '%;background-color:' + colorFor(p) + ';"></div>' +
              '    </div>' +
              '  </div>' +
              '</div>'
            );
          }).join('');
          chartHtml =
            '<section class="tepa-menti-hlist tepa-anim-enter" data-h-density="' + getHDensity(displayList.length) + '" style="--h-count:' + Math.max(1, displayList.length) + ';">' +
            hRowsHtml +
            '</section>';
        }

        var qrSidebar = state.showQrSidebar
          ? '<aside class="tepa-menti-sidebar tepa-anim-enter">' +
            '  <div class="tepa-menti-qrcard">' +
            '    <button type="button" class="tepa-menti-qrclose" data-action="toggle-qr" title="Hide QR">×</button>' +
            '    <div class="tepa-menti-qrwrap" id="tepa-stage-vote-qr"></div>' +
            '    <div class="tepa-menti-qrsub">Scan QR to vote</div>' +
            '    <div class="tepa-menti-qrhost">' + esc(shortHostLabel(voteTargetUrl)) + '</div>' +
            '  </div>' +
            '  <div class="tepa-menti-waitcard" id="tepa-menti-wait-text">' +
            (totalVotes === 0 ? 'Waiting for participants' : totalVotes + (totalVotes === 1 ? ' vote received' : ' votes received')) +
            '  </div>' +
            '</aside>'
          : '';

        workspaceHtml = '<div class="tepa-menti-workspace">' + chartHtml + qrSidebar + '</div>';
      }

      var dockBar =
        '<footer class="tepa-menti-dockbar">' +
        '  <div class="tepa-menti-dock-group">' +
        '    <button type="button" class="tepa-menti-pill-btn ' + (stageMode === 'quiz_qr' ? 'is-active' : '') + '" data-stage="quiz_qr">Welcome Quiz</button>' +
        '    <button type="button" class="tepa-menti-pill-btn ' + (stageMode === 'live_voting' ? 'is-active' : '') + '" data-stage="live_voting">Live Voting</button>' +
        '    <button type="button" class="tepa-menti-pill-btn ' + (stageMode === 'winner_reveal' ? 'is-active' : '') + '" data-stage="winner_reveal">Best of the Best</button>' +
        '    <button type="button" class="tepa-menti-icon-circle" data-action="toggle-theme" title="Switch Light / Dark Mode">' + bulbIcon + '</button>' +
        '  </div>' +
        (stageMode === 'live_voting'
          ? '<div class="tepa-menti-center-dock">' +
            '  <button type="button" class="tepa-menti-dock-tool ' + (state.chartType === 'horizontal' ? 'is-active' : '') + '" data-chart="horizontal" title="Ranked List">' + hChartIcon + '<span>List</span></button>' +
            '  <button type="button" class="tepa-menti-dock-tool ' + (state.chartType === 'vertical' ? 'is-active' : '') + '" data-chart="vertical" title="Columns">' + vChartIcon + '<span>Columns</span></button>' +
            '  <button type="button" class="tepa-menti-dock-tool ' + (state.showQrSidebar ? 'is-active' : '') + '" data-action="toggle-qr" title="Toggle QR Card">' + qrIcon + '<span>QR</span></button>' +
            '  <button type="button" class="tepa-menti-dock-tool ' + (state.hideResults ? 'is-active' : '') + '" data-action="toggle-hide-results" title="Hide / Show Results">' + eyeIcon + '<span>' + (state.hideResults ? 'Show' : 'Hide') + '</span></button>' +
            '</div>'
          : '<div></div>') +
        '  <div class="tepa-menti-dock-group">' +
        '    <span class="tepa-menti-pill-btn" style="cursor:default;">👥 <strong id="tepa-menti-total-pill">' + totalVotes + '</strong></span>' +
        '  </div>' +
        '</footer>';

      var stageEl = root.querySelector('.tepa-menti-stage');
      var onlyThemeSwitch = prevKey && prevKey !== renderKey && prevKey.replace(/\|(light|dark)\|/, '|X|') === renderKey.replace(/\|(light|dark)\|/, '|X|');
      if (stageEl && onlyThemeSwitch) {
        stageEl.setAttribute('data-live-theme', state.theme);
        return;
      }

      root.innerHTML =
        '<div class="tepa-menti-stage" data-live-theme="' + esc(state.theme) + '">' +
        topBar +
        headlineRow +
        workspaceHtml +
        dockBar +
        '</div>';

      if (stageMode === 'quiz_qr') {
        renderQR(root.querySelector('#tepa-stage-quiz-qr'), quizTargetUrl);
      } else if (stageMode === 'live_voting') {
        if (state.showQrSidebar) {
          renderQR(root.querySelector('#tepa-stage-vote-qr'), voteTargetUrl);
        }
        if (state.chartType === 'horizontal') {
          springAnimateBars(root, '.tepa-menti-hfill', 'width', 20);
        } else {
          springAnimateBars(root, '.tepa-menti-vbar', 'height', 30);
        }
      } else if (stageMode === 'winner_reveal' && ranked[0] && totalVotes > 0) {
        animateNumber(root.querySelector('#tepa-reveal-votes'), ranked[0].votes, function (n) { return String(Math.round(n)); }, 720, 0);
        animateNumber(root.querySelector('#tepa-reveal-pct'), Math.round((ranked[0].votes / totalVotes) * 100), function (n) { return Math.round(n) + '%'; }, 720, 0);
      }
    }

    root.addEventListener('click', function (ev) {
      if (!ev.target || !ev.target.closest) return;
      var stBtn = ev.target.closest('[data-stage]');
      if (stBtn) {
        state.localStageOverride = stBtn.getAttribute('data-stage');
        render();
        return;
      }
      var chBtn = ev.target.closest('[data-chart]');
      if (chBtn) {
        state.chartType = chBtn.getAttribute('data-chart');
        render();
        return;
      }
      var scBtn = ev.target.closest('[data-vscope]');
      if (scBtn) {
        state.verticalScope = scBtn.getAttribute('data-vscope');
        render();
        return;
      }
      var actBtn = ev.target.closest('[data-action]');
      if (!actBtn) return;
      var act = actBtn.getAttribute('data-action');
      if (act === 'toggle-sort') {
        state.sortMode = state.sortMode === 'votes' ? 'slot' : 'votes';
        render();
      } else if (act === 'toggle-qr') {
        state.showQrSidebar = !state.showQrSidebar;
        render();
      } else if (act === 'toggle-hide-results') {
        state.hideResults = !state.hideResults;
        render();
      } else if (act === 'toggle-theme') {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        try { global.localStorage.setItem(THEME_KEY, state.theme); } catch (e) {}
        render();
      } else if (act === 'fullscreen') {
        if (!document.fullscreenElement) {
          root.requestFullscreen && root.requestFullscreen().catch(function () {});
        } else {
          document.exitFullscreen && document.exitFullscreen().catch(function () {});
        }
      }
    });

    refresh();
    unsubscribe = Store.subscribeRealtime(function () {
      refresh();
    });
    safetyPoll = setInterval(refresh, 3000);
    global.addEventListener('beforeunload', function () {
      if (unsubscribe) unsubscribe();
      if (safetyPoll) clearInterval(safetyPoll);
    });
  }

  // =========================================================================
  // 4. ADMIN COMMAND CENTER ([data-tepa-app="admin"])
  // =========================================================================

  function mountAdminApp(root) {
    var PIN_SESSION_KEY = 'tepa_admin_pin_v1';
    var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
    var VALID_TABS = { stage: 1, livescreen: 1, questions: 1, projects: 1, submissions: 1, settings: 1, audit: 1 };
    var initCfg = Store.getConfig();
    var initialTab = (initCfg.wpAdminTab && VALID_TABS[initCfg.wpAdminTab]) ? initCfg.wpAdminTab : 'stage';
    var savedPin = (function () { try { return sessionStorage.getItem(PIN_SESSION_KEY) || ''; } catch (e) { return ''; } })();
    if (!savedPin && initCfg.isWpAdmin && initCfg.defaultPin) {
      savedPin = initCfg.defaultPin;
    }

    // Modern Lucide-style Vector SVG Icons (Zero Cartoon Emojis)
    var SVG_PATHS = {
      radio: '<circle cx="12" cy="12" r="2"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
      sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M3 5h4"/>',
      trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
      gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
      ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
      qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
      shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
      monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
      help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
      vote: '<path d="m9 12 2 2 4-4"/><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z"/><path d="M22 19H2"/>',
      lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
      maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
      layout: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
      arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
      arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
      external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
      barChart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
      zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
      refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
      trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
      arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
      arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
      plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
      copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
      check: '<path d="M20 6 9 17l-5-5"/>',
      x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
      smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
      eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
      eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
      moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
      list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>'
    };

    function icon(name, size) {
      var sz = size || 16;
      var body = SVG_PATHS[name] || SVG_PATHS.sparkles;
      return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
    }

    var state = {
      pin: savedPin,
      manuallyLocked: false,
      tab: initialTab, // 'stage' | 'questions' | 'projects' | 'submissions' | 'settings' | 'audit'
      subFilter: 'all', // 'all' | 'winners' | 'pending' | 'redeemed'
      projFilter: 'all', // 'all' | 'active' | 'hidden'
      projSearch: '',
      search: '',
      selectedQuizId: null,
      selectedPollId: null,
      previewScreen: 'cover', // 'cover' | 'questions'
      previewQIdx: 0,
      quizDrafts: {},
      pollDrafts: {},
      pollCopyDraft: null,
      data: null,
      loading: true,
      saving: false,
      notice: '',
      noticeType: 'ok',
      error: '',
      dirtyProjects: {},
      dirtyQuestions: {},
      confirmModal: null,
      hasAnimatedKpis: false
    };
    var unsubscribe = null;
    var noticeTimer = null;

    var SECTION_META = {
      stage: {
        iconName: 'radio',
        title: 'Live Stage & Controls',
        desc: 'Control the 16:9 auditorium screen, mobile participation gates, and rehearsal rounds in real time.'
      },
      livescreen: {
        iconName: 'monitor',
        title: '16:9 Live Screen Director',
        desc: 'Dedicated real-time remote control for the 16:9 auditorium projection: stage scenes, chart layouts, theme, QR sidebar, and live winner reveals.'
      },
      questions: {
        iconName: 'sparkles',
        title: 'Quiz Studio',
        desc: 'Build custom quizzes, Yes/No or Multiple Choice questions, prize rules, and preview live on mobile.'
      },
      projects: {
        iconName: 'trophy',
        title: 'Voting Studio & Polls',
        desc: 'Create multiple voting polls or finalist showcases, switch 16:9 poll formats, and manage options live.'
      },
      submissions: {
        iconName: 'gift',
        title: 'Winners & Prize Desk',
        desc: 'Verify TEPA-XXXXXX participant codes, track Café Bonjour voucher redemptions, and export CSV.'
      },
      settings: {
        iconName: 'qr',
        title: 'QR Kit & WordPress Connection',
        desc: 'High-resolution print QR kit (SVG/PNG 1024px), cloud database credentials, and security PIN.'
      },
      audit: {
        iconName: 'shield',
        title: 'System Audit & Diagnostics',
        desc: 'Automated real-time verification of WordPress/RLS security, active percentages, and event readiness.'
      }
    };

    function flash(msg, isErr) {
      clearTimeout(noticeTimer);
      state.notice = msg;
      state.noticeType = isErr ? 'err' : 'ok';
      var slot = root.querySelector('#tepa-bo-toast-slot');
      if (slot) {
        slot.innerHTML = msg
          ? '<span class="tepa-bo-toast tepa-anim-enter ' + (isErr ? 'is-err' : '') + '">' + esc(msg) + '</span>'
          : '';
      }
      noticeTimer = setTimeout(function () {
        if (state.notice === msg) {
          state.notice = '';
          var curSlot = root.querySelector('#tepa-bo-toast-slot');
          if (curSlot) curSlot.innerHTML = '';
        }
      }, 3200);
    }

    function isUserEditingInRoot() {
      var active = document.activeElement;
      if (!active || !root.contains(active)) return false;
      if (active.id === 'tepa-admin-search' || active.id === 'tepa-proj-search') return false;
      var tag = (active.tagName || '').toUpperCase();
      if (tag === 'INPUT') {
        var inpType = (active.type || '').toLowerCase();
        if (inpType === 'checkbox' || inpType === 'radio' || inpType === 'button' || inpType === 'submit') {
          return false;
        }
      }
      return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    }

    function cloneSimple(o) {
      try { return JSON.parse(JSON.stringify(o)); } catch (e) { return Object.assign({}, o); }
    }

    function ensureSelectedQuiz(data) {
      var quizzes = (data && data.quizzes) || [];
      if (!quizzes.length) return null;
      var found = quizzes.find(function (q) { return q.id === state.selectedQuizId; });
      if (found) return found;
      var activeId = data && data.settings && data.settings.active_quiz_id;
      var activeQuiz = quizzes.find(function (q) { return q.id === activeId; }) || quizzes[0];
      state.selectedQuizId = activeQuiz.id;
      return activeQuiz;
    }

    function getQuizDraft(orig) {
      if (!orig) return null;
      var d = state.quizDrafts[orig.id];
      return d ? Object.assign({}, orig, d) : orig;
    }

    function ensureSelectedPoll(data) {
      var polls = (data && data.polls) || [];
      if (!polls.length) return null;
      var found = polls.find(function (pl) { return pl.id === state.selectedPollId; });
      if (found) return found;
      var activeId = data && data.settings && data.settings.active_poll_id;
      var activePoll = polls.find(function (pl) { return pl.id === activeId; }) || polls[0];
      state.selectedPollId = activePoll.id;
      return activePoll;
    }

    function getPollDraft(orig) {
      if (!orig) return null;
      var d = state.pollDrafts[orig.id];
      return d ? Object.assign({}, orig, d) : orig;
    }

    function getProjectDraft(orig) {
      var dirty = state.dirtyProjects[orig.id];
      return dirty ? Object.assign({}, orig, dirty) : orig;
    }

    function getQuestionDraft(orig) {
      var dirty = state.dirtyQuestions[orig.id];
      var merged = dirty ? Object.assign({}, orig, dirty) : cloneSimple(orig);
      if (!Array.isArray(merged.options)) merged.options = [];
      merged.question_type = merged.question_type || 'yes_no';
      return merged;
    }

    function computeKpis(data) {
      var s = (data && data.settings) || {};
      var subs = (data && data.submissions) || [];
      var projects = (data && data.projects) || [];
      var polls = (data && data.polls) || [];
      var activePoll = polls.find(function (pl) { return pl.id === s.active_poll_id; }) || polls[0] || null;
      var pollProjects = activePoll
        ? projects.filter(function (p) { return !p.poll_id || p.poll_id === activePoll.id; })
        : projects;
      var activeProjects = pollProjects.filter(function (p) { return getProjectDraft(p).is_active !== false; });
      var quizzes = (data && data.quizzes) || [];
      var activeQuiz = quizzes.find(function (q) { return q.id === s.active_quiz_id; }) || quizzes[0] || null;
      var totalVotes = activeProjects.reduce(function (acc, p) { return acc + (Number(p.votes) || 0); }, 0);
      var sortedProjects = activeProjects.slice().sort(function (a, b) {
        return (Number(b.votes) || 0) - (Number(a.votes) || 0) || (a.sort_order || a.slot_number) - (b.sort_order || b.slot_number);
      });
      var leader = totalVotes > 0 ? sortedProjects[0] : null;
      var leaderPct = leader && totalVotes > 0 ? Math.round(((leader.votes || 0) / totalVotes) * 100) : 0;
      var voucherWinners = subs.filter(function (x) { return x.is_voucher_winner; });
      var redeemedCount = voucherWinners.filter(function (x) { return x.voucher_claimed; }).length;
      var passedCount = subs.filter(function (x) { return x.passed_criteria; }).length;
      var maxVouchers = Number((activeQuiz && activeQuiz.max_vouchers) || s.max_vouchers || 10);
      var voucherPct = maxVouchers > 0 ? Math.min(100, Math.round((voucherWinners.length / maxVouchers) * 100)) : 0;
      return {
        s: s,
        subs: subs,
        projects: projects,
        pollProjects: pollProjects,
        polls: polls,
        activePoll: activePoll,
        isSimpleActivePoll: Boolean(activePoll && activePoll.poll_type === 'simple'),
        activeProjects: activeProjects,
        quizzes: quizzes,
        activeQuiz: activeQuiz,
        sortedProjects: sortedProjects,
        totalVotes: totalVotes,
        leader: leader,
        leaderPct: leaderPct,
        voucherWinners: voucherWinners,
        redeemedCount: redeemedCount,
        passedCount: passedCount,
        maxVouchers: maxVouchers,
        voucherPct: voucherPct
      };
    }

    function patchKpisInPlace(data, animateFromZero) {
      var k = computeKpis(data);
      var el;
      var initFromZero = animateFromZero ? 0 : undefined;

      el = root.querySelector('[data-kpi-votes]');
      if (el) animateNumber(el, k.totalVotes, function (n) { return String(Math.round(n)); }, 520, initFromZero);
      el = root.querySelector('[data-kpi-votes-badge]');
      if (el) {
        el.textContent = k.s.voting_open ? 'Voting Open' : 'Voting Closed';
        el.className = 'tepa-bo-badge ' + (k.s.voting_open ? 'is-green' : 'is-red');
      }
      el = root.querySelector('[data-kpi-votes-sub]');
      if (el) el.textContent = 'Round #' + (k.s.vote_epoch || 1) + ' · ' + k.activeProjects.length + (k.isSimpleActivePoll ? ' active options' : ' active finalists');

      el = root.querySelector('[data-kpi-leader]');
      if (el) {
        el.textContent = k.leader ? k.leader.project_title : 'No votes yet';
        el.title = k.leader ? k.leader.project_title : '';
      }
      el = root.querySelector('[data-kpi-leader-sub]');
      if (el) {
        el.textContent = k.leader
          ? ((k.leader.votes || 0) + ' votes (' + k.leaderPct + '%)' + (k.leader.category_name ? (' · ' + k.leader.category_name) : ''))
          : 'Waiting for first vote';
      }

      el = root.querySelector('[data-kpi-quiz]');
      if (el) animateNumber(el, k.subs.length, function (n) { return String(Math.round(n)); }, 520, initFromZero);
      el = root.querySelector('[data-kpi-quiz-badge]');
      if (el) {
        el.textContent = k.s.quiz_open ? 'Quiz Open' : 'Quiz Closed';
        el.className = 'tepa-bo-badge ' + (k.s.quiz_open ? 'is-green' : 'is-red');
      }
      el = root.querySelector('[data-kpi-quiz-sub]');
      if (el) el.textContent = k.passedCount + ' passed min score · Round #' + (k.s.quiz_epoch || 1);

      el = root.querySelector('[data-kpi-vouchers]');
      if (el) el.textContent = k.voucherWinners.length + ' / ' + k.maxVouchers;
      el = root.querySelector('[data-kpi-vouchers-badge]');
      if (el) el.textContent = 'First ' + k.maxVouchers;
      el = root.querySelector('[data-kpi-vouchers-sub]');
      if (el) el.textContent = k.redeemedCount + ' redeemed at prize desk';
      el = root.querySelector('[data-kpi-vouchers-bar]');
      if (el) el.style.width = k.voucherPct + '%';
    }

    function syncFloatingSaveBar() {
      var slot = root.querySelector('#tepa-bo-floating-slot');
      if (!slot) return;
      var pCount = Object.keys(state.dirtyProjects).length;
      var qCount = Object.keys(state.dirtyQuestions).length;
      var totalDirty = pCount + qCount;
      if (!totalDirty) {
        slot.innerHTML = '';
        return;
      }
      var isProj = pCount > 0 && (state.tab === 'projects' || qCount === 0);
      var count = isProj ? pCount : qCount;
      var label = isProj
        ? (count + ' option/project edit' + (count > 1 ? 's' : '') + ' unsaved')
        : (count + ' question edit' + (count > 1 ? 's' : '') + ' unsaved');
      var discardAct = isProj ? 'discard-projects' : 'discard-questions';
      var saveAct = isProj ? 'save-all-projects' : 'save-all-questions';

      slot.innerHTML =
        '<div class="tepa-bo-floating-save">' +
        '  <div style="display:flex;align-items:center;gap:10px;">' +
        '    <span class="tepa-bo-badge is-gold">' + icon('zap', 12) + ' Unsaved Changes</span>' +
        '    <strong style="font-size:13px;">' + esc(label) + '</strong>' +
        '  </div>' +
        '  <div style="display:flex;align-items:center;gap:8px;">' +
        '    <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="' + discardAct + '">Discard</button>' +
        '    <button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-primary" data-action="' + saveAct + '" ' + (state.saving ? 'disabled' : '') + '>' + icon('check', 13) + ' ' + (state.saving ? 'Saving...' : 'Save All Now (Ctrl+S)') + '</button>' +
        '  </div>' +
        '</div>';
    }

    function syncTabsInPlace(data) {
      var selQuiz = ensureSelectedQuiz(data);
      var allQs = (data && data.questions) || [];
      var quizQs = selQuiz
        ? allQs.filter(function (q) { return !q.quiz_id || q.quiz_id === selQuiz.id; })
        : allQs;
      var selPoll = ensureSelectedPoll(data);
      var projects = (data && data.projects) || [];
      var selProjs = selPoll
        ? projects.filter(function (p) { return !p.poll_id || p.poll_id === selPoll.id; })
        : projects;
      var activeProjCount = selProjs.filter(function (p) { return getProjectDraft(p).is_active !== false; }).length;
      var subCount = ((data && data.submissions) || []).length;
      var dirtyProjCount = selProjs.filter(function (p) { return Boolean(state.dirtyProjects[p.id]); }).length;
      var dirtyQCount = quizQs.filter(function (q) { return Boolean(state.dirtyQuestions[q.id]); }).length;
      var s = (data && data.settings) || {};

      root.querySelectorAll('[data-tab]').forEach(function (t) {
        if (t.classList.contains('tepa-bo-nav-item') || t.classList.contains('tepa-bo-tab')) {
          t.classList.toggle('is-active', t.getAttribute('data-tab') === state.tab);
        }
      });

      var meta = SECTION_META[state.tab] || SECTION_META.stage;
      var topIcon = root.querySelector('#tepa-bo-topbar-icon');
      if (topIcon) topIcon.innerHTML = icon(meta.iconName, 18);
      var topTitle = root.querySelector('#tepa-bo-topbar-title');
      if (topTitle) topTitle.textContent = meta.title;
      var topDesc = root.querySelector('#tepa-bo-topbar-desc');
      if (topDesc) topDesc.textContent = meta.desc;

      var stBadge = root.querySelector('[data-tab-count="stage"]');
      if (stBadge) {
        stBadge.textContent = s.stage_mode === 'quiz_qr' ? 'Quiz QR' : (s.stage_mode === 'winner_reveal' ? 'Winner' : 'Voting');
      }
      var lsBadge = root.querySelector('[data-tab-count="livescreen"]');
      if (lsBadge) {
        lsBadge.textContent = (s.live_theme === 'dark' ? 'Dark' : 'Light') + ' · ' + (s.stage_mode === 'quiz_qr' ? 'S1' : (s.stage_mode === 'winner_reveal' ? 'S3' : 'S2'));
      }
      var qc = root.querySelector('[data-tab-count="questions"]');
      if (qc) {
        qc.textContent = quizQs.length + (dirtyQCount ? ' · ' + dirtyQCount + '*' : '');
        qc.classList.toggle('is-dirty', dirtyQCount > 0);
      }
      var pc = root.querySelector('[data-tab-count="projects"]');
      if (pc) {
        pc.textContent = (activeProjCount === selProjs.length ? String(selProjs.length) : (activeProjCount + '/' + selProjs.length)) + (dirtyProjCount ? '*' : '');
        pc.classList.toggle('is-dirty', dirtyProjCount > 0);
      }
      var sc = root.querySelector('[data-tab-count="submissions"]');
      if (sc) sc.textContent = String(subCount);

      root.querySelectorAll('[data-quick-stage]').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-val') === s.stage_mode);
      });
    }

    function updateDirtyCountersInPlace() {
      var pCount = Object.keys(state.dirtyProjects).length;
      var qCount = Object.keys(state.dirtyQuestions).length;
      var pBadge = root.querySelector('[data-dirty-proj-badge]');
      if (pBadge) {
        pBadge.textContent = pCount ? (pCount + ' unsaved edit' + (pCount > 1 ? 's' : '')) : 'All synced';
        pBadge.className = 'tepa-bo-badge ' + (pCount ? 'is-gold' : 'is-green');
      }
      var pDisc = root.querySelector('[data-action="discard-projects"]');
      if (pDisc) pDisc.style.display = pCount ? '' : 'none';

      var qBadge = root.querySelector('[data-dirty-q-badge]');
      if (qBadge) {
        qBadge.textContent = qCount ? (qCount + ' unsaved edit' + (qCount > 1 ? 's' : '')) : 'All synced';
        qBadge.className = 'tepa-bo-badge ' + (qCount ? 'is-gold' : 'is-green');
      }
      var qDisc = root.querySelector('[data-action="discard-questions"]');
      if (qDisc) qDisc.style.display = qCount ? '' : 'none';

      if (state.data) syncTabsInPlace(state.data);
      syncFloatingSaveBar();
    }

    async function loadAdmin(silent) {
      var mode = Store.getMode();
      var cfg = Store.getConfig();
      if (cfg.requireWpAdmin && !cfg.isWpAdmin) {
        state.loading = false;
        render(true);
        return;
      }
      if (mode === 'supabase' && !state.pin) {
        state.loading = false;
        render(true);
        return;
      }
      try {
        var res = await Store.adminAction(state.pin || '2026', 'get_admin_data');
        if (!res || !res.ok) {
          state.error = (res && res.error) || 'Invalid Admin PIN.';
          if (mode === 'supabase') {
            state.pin = '';
            try { sessionStorage.removeItem(PIN_SESSION_KEY); } catch (e) {}
          }
          state.data = null;
        } else {
          state.error = '';
          state.data = res;
        }
      } catch (err) {
        state.error = (err && err.message) || 'Failed to load admin data.';
      } finally {
        state.loading = false;
        if (silent && state.data && (isUserEditingInRoot() || state.confirmModal)) {
          patchKpisInPlace(state.data, false);
        } else {
          render(!silent);
        }
      }
    }

    function downloadCsv(rows) {
      var header = ['Rank', 'Full Name', 'Unique ID', 'Score', 'Total', 'Passed', 'Voucher Winner', 'Voucher Claimed', 'Submitted At'];
      var lines = [header.join(',')];
      rows.forEach(function (r) {
        var cols = [
          r.winner_rank || '',
          '"' + String(r.full_name || '').replace(/"/g, '""') + '"',
          r.unique_code || '',
          r.score,
          r.total_questions,
          r.passed_criteria ? 'YES' : 'NO',
          r.is_voucher_winner ? 'YES' : 'NO',
          r.voucher_claimed ? 'CLAIMED' : 'PENDING',
          r.created_at || ''
        ];
        lines.push(cols.join(','));
      });
      var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'tepa-2026-quiz-winners.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    function copyText(text, label) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          flash(label + ' copied!');
        }).catch(function () {
          flash(label + ': ' + text);
        });
      } else {
        flash(label + ': ' + text);
      }
    }

    function downloadQrPng(svgHtml, fileName) {
      if (!svgHtml) return;
      var svgBlob = new Blob([svgHtml], { type: 'image/svg+xml;charset=utf-8' });
      var svgUrl = URL.createObjectURL(svgBlob);
      var img = new Image();
      img.onload = function () {
        var size = 1024;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob(function (pngBlob) {
          if (!pngBlob) return;
          var pngUrl = URL.createObjectURL(pngBlob);
          var dl = document.createElement('a');
          dl.href = pngUrl;
          dl.download = fileName;
          dl.click();
          setTimeout(function () { URL.revokeObjectURL(pngUrl); }, 500);
        }, 'image/png');
      };
      img.onerror = function () {
        URL.revokeObjectURL(svgUrl);
        flash('Could not export PNG.', true);
      };
      img.src = svgUrl;
    }

    function mountWpSettingsTemplate(containerId) {
      var tpl = document.getElementById('tepa-wp-settings-tpl');
      var mount = root.querySelector('#' + containerId);
      if (tpl && mount) {
        mount.innerHTML = '';
        mount.appendChild(tpl.content.cloneNode(true));
        return true;
      }
      return false;
    }

    function syncAdminModal() {
      var slot = root.querySelector('#tepa-bo-modal-slot');
      if (!slot) return;
      if (!state.confirmModal) {
        slot.innerHTML = '';
        return;
      }
      slot.innerHTML =
        '<div class="tepa-bo-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tepa-modal-title">' +
        '  <div class="tepa-bo-modal">' +
        '    <h3 id="tepa-modal-title" class="tepa-bo-card-title" style="font-size:17px;">' + esc(state.confirmModal.title) + '</h3>' +
        '    <p style="margin-top:8px;">' + esc(state.confirmModal.message) + '</p>' +
        '    <div class="tepa-bo-modal-actions">' +
        '      <button type="button" class="tepa-bo-btn" data-action="cancel-confirm-modal">Cancel</button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-danger" data-action="execute-confirm-modal">' + esc(state.confirmModal.confirmLabel) + '</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    }

    function renderBrandBlock(subtitleHtml) {
      return (
        '<div class="tepa-bo-brand">' +
        '  <div class="tepa-bo-brand-logos">' +
        '    <img class="tepa-bo-te-logo" src="' + esc(assetUrl('totalenergies-logo.png')) + '" alt="TotalEnergies">' +
        '    <span class="tepa-bo-lu-badge"><img src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP"></span>' +
        '  </div>' +
        '  <div>' +
        '    <h1 class="tepa-bo-title">TEPA Performance Award 2026</h1>' +
        '    <div class="tepa-bo-sub">' + subtitleHtml + '</div>' +
        '  </div>' +
        '</div>'
      );
    }

    function buildPhonePreviewHtml() {
      if (!state.data) return '';
      var selQuiz = ensureSelectedQuiz(state.data);
      if (!selQuiz) return '';
      var qDraft = getQuizDraft(selQuiz);
      var allQs = (state.data.questions || []).filter(function (q) {
        return !q.quiz_id || q.quiz_id === selQuiz.id;
      });
      var previewQs = allQs.map(getQuestionDraft).filter(function (q) { return q.is_active !== false; });
      var qTitle = qDraft.title || 'Quiz';
      var qSub = qDraft.subtitle || 'Test your knowledge!';

      if (state.previewScreen === 'cover') {
        return (
          '<div class="tepa-bo-phone-screen tepa-anim-enter" style="justify-content:center;gap:12px;">' +
          '  <img src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP" style="height:34px;width:auto;margin:0 auto;">' +
          '  <div class="tepa-rainbow-line" style="max-width:210px;"></div>' +
          '  <div class="tepa-rainbow-text" style="font-size:' + (qTitle.length > 10 ? '28px' : '38px') + ';font-weight:800;line-height:1.05;margin-top:8px;">' + esc(qTitle) + '</div>' +
          '  <p style="color:#E2E8F0;font-size:12.5px;line-height:1.45;margin:4px 0 12px;">' + esc(qSub) + '</p>' +
          '  <div style="margin-top:auto;">' +
          '    <span class="tepa-btn-cta" style="width:170px;min-height:36px;padding:8px 16px;font-size:14px;border-radius:12px;">ANSWER</span>' +
          '  </div>' +
          '</div>'
        );
      }

      if (state.previewQIdx >= previewQs.length) state.previewQIdx = 0;
      var qIdx = Math.max(0, state.previewQIdx || 0);
      var curQ = previewQs[qIdx];
      var sampleBody = '<p style="color:#94A3B8;font-size:12px;margin-top:40px;">No active questions in this quiz yet. Click + Yes / No or + Multiple Choice.</p>';
      if (curQ) {
        var isMc = curQ.question_type === 'multiple_choice' && curQ.options && curQ.options.length;
        var pctPreview = Math.max(15, Math.round(((qIdx + 1) / Math.max(1, previewQs.length)) * 100));
        var optHtml = isMc
          ? curQ.options.map(function (opt, idx) {
              var isRight = Number(curQ.correct_option || 0) === idx;
              return (
                '<div style="padding:7px 10px;border-radius:10px;border:1px solid ' + (isRight ? '#16A34A' : 'rgba(255,255,255,0.16)') + ';background:' + (isRight ? 'rgba(22,163,74,0.22)' : 'rgba(255,255,255,0.05)') + ';display:flex;align-items:center;gap:8px;font-size:11.5px;text-align:left;color:#FFFFFF;">' +
                '  <span style="width:20px;height:20px;border-radius:6px;background:rgba(255,255,255,0.12);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;">' + (LETTERS[idx] || (idx + 1)) + '</span>' +
                '  <span style="flex:1;">' + esc(opt) + '</span>' +
                (isRight ? '<span style="color:#8BE39B;font-weight:700;">✓</span>' : '') +
                '</div>'
              );
            }).join('')
          : '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
            '  <div style="padding:9px;border-radius:11px 0 0 11px;background:var(--tepa-grad-cta);font-weight:700;font-size:12px;opacity:' + (curQ.correct_answer ? '1' : '0.45') + ';">' + (curQ.correct_answer ? '✓ Yes' : 'Yes') + '</div>' +
            '  <div style="padding:9px;border-radius:0 11px 11px 0;background:var(--tepa-grad-cta);font-weight:700;font-size:12px;opacity:' + (!curQ.correct_answer ? '1' : '0.45') + ';">' + (!curQ.correct_answer ? '✓ No' : 'No') + '</div>' +
            '</div>';

        sampleBody =
          '<div style="display:flex;align-items:center;gap:8px;font-size:10.5px;color:#C7C9D9;margin-bottom:4px;">' +
          '  <span>Q' + (qIdx + 1) + ' / ' + previewQs.length + '</span>' +
          '  <div style="flex:1;height:4px;background:rgba(255,255,255,0.12);border-radius:99px;"><div style="width:' + pctPreview + '%;height:100%;background:var(--tepa-grad-rainbow);border-radius:99px;transition:width 0.3s ease;"></div></div>' +
          '  <span>' + pctPreview + '%</span>' +
          '</div>' +
          '<div class="tepa-question-card" style="padding:12px;min-height:70px;margin-bottom:8px;text-align:left;">' +
          '  <div class="tepa-question-num" style="font-size:28px;min-width:34px;">' + pad2(qIdx + 1) + '</div>' +
          '  <div class="tepa-question-text" style="font-size:12px;">' + esc(curQ.question_text) + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:6px;">' + optHtml + '</div>' +
          '<div style="margin-top:auto;font-size:11px;color:#94A3B8;padding-top:8px;">Showing ' + Math.min(Number(qDraft.questions_per_page || 2), previewQs.length) + ' per mobile screen</div>';
      }

      return (
        '<div class="tepa-bo-phone-screen tepa-anim-enter" style="justify-content:flex-start;">' +
        '  <img src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP" style="height:24px;width:auto;margin:0 auto 2px;">' +
        '  <div class="tepa-rainbow-text" style="font-size:15px;font-weight:800;letter-spacing:0.03em;">' + esc(qTitle.toUpperCase()) + '</div>' +
        sampleBody +
        '</div>'
      );
    }

    function buildPhoneQPillsHtml() {
      if (!state.data || state.previewScreen !== 'questions') return '';
      var selQuiz = ensureSelectedQuiz(state.data);
      if (!selQuiz) return '';
      var allQs = (state.data.questions || []).filter(function (q) {
        return !q.quiz_id || q.quiz_id === selQuiz.id;
      });
      var previewQs = allQs.map(getQuestionDraft).filter(function (q) { return q.is_active !== false; });
      if (previewQs.length <= 1) return '';
      if (state.previewQIdx >= previewQs.length) state.previewQIdx = 0;
      return (
        '<div class="tepa-bo-phone-q-pills">' +
        previewQs.map(function (_, idx) {
          return '<button type="button" class="tepa-bo-phone-q-pill ' + (idx === state.previewQIdx ? 'is-active' : '') + '" data-preview-qidx="' + idx + '">Q' + pad2(idx + 1) + '</button>';
        }).join('') +
        '</div>'
      );
    }

    function updatePhonePreviewInPlace() {
      root.querySelectorAll('[data-preview-mode]').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-preview-mode') === state.previewScreen);
      });
      var qPillsSlot = root.querySelector('#tepa-bo-phone-qpills-slot');
      if (qPillsSlot) qPillsSlot.innerHTML = buildPhoneQPillsHtml();
      var box = root.querySelector('#tepa-bo-phone-preview-body');
      if (box) box.innerHTML = buildPhonePreviewHtml();
    }

    function buildTabPanelHtml() {
      var k = computeKpis(state.data);
      var s = k.s;
      var subs = k.subs;
      var projects = k.projects;
      var allQs = state.data.questions || [];
      var quizzes = k.quizzes;
      var cfg = Store.getConfig();
      var mode = Store.getMode();
      var hasWpTpl = Boolean(document.getElementById('tepa-wp-settings-tpl'));
      var voteScreenUrl = cfg.homeUrl || cfg.voteUrl || 'vote.html';
      var quizScreenUrl = cfg.quizUrl || 'quiz.html';
      var liveScreenUrl = cfg.liveUrl || 'live.html';

      if (state.tab === 'stage') {
        var top5 = k.sortedProjects.slice(0, 5);
        var maxTopVotes = Math.max(1, Number((top5[0] && top5[0].votes) || 0));
        var barPalette = ['#E74425', '#2194D4', '#64BD75', '#8F4F9E', '#F77B39'];

        return (
          '<div class="tepa-bo-grid-2">' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('monitor', 15) + '</span><h2 class="tepa-bo-card-title">Auditorium 16:9 Stage Screen</h2></div>' +
          '        <p class="tepa-bo-card-desc">Switch what everyone sees on the big screen in realtime.</p>' +
          '      </div>' +
          '      <a href="' + esc(liveScreenUrl) + '" target="_blank" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-primary">' + icon('external', 13) + '<span>Launch Stage</span></a>' +
          '    </div>' +
          '    <div class="tepa-bo-stage-list">' +
          '      <button type="button" class="tepa-bo-stage-card ' + (s.stage_mode === 'quiz_qr' ? 'is-active' : '') + '" data-action="set-stage" data-val="quiz_qr">' +
          '        <span class="tepa-bo-stage-num">' + icon('qr', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">1. Welcome Quiz QR &amp; Official Winners</span>' +
          '          <span class="tepa-bo-stage-desc">Shows join QR code (' + esc(k.voucherWinners.length) + ' / ' + esc(k.maxVouchers) + ' qualified · ' + (s.reveal_quiz_winners ? 'Winners Announced on 16:9' : 'Winners Hidden until Announced') + ').</span>' +
          '        </span>' +
          (s.stage_mode === 'quiz_qr' ? '<span class="tepa-bo-badge is-green">● Live Now</span>' : '') +
          '      </button>' +
          '      <button type="button" class="tepa-bo-stage-card ' + (s.stage_mode === 'live_voting' ? 'is-active' : '') + '" data-action="set-stage" data-val="live_voting">' +
          '        <span class="tepa-bo-stage-num">' + icon('barChart', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">2. Live Voting Ranking + QR</span>' +
          '          <span class="tepa-bo-stage-desc">Adaptive Mentimeter list or column chart across ' + k.activeProjects.length + ' active finalist projects.</span>' +
          '        </span>' +
          (s.stage_mode === 'live_voting' ? '<span class="tepa-bo-badge is-green">● Live Now</span>' : '') +
          '      </button>' +
          '      <button type="button" class="tepa-bo-stage-card ' + (s.stage_mode === 'winner_reveal' ? 'is-active' : '') + '" data-action="set-stage" data-val="winner_reveal">' +
          '        <span class="tepa-bo-stage-num">' + icon('trophy', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">3. Reveal Best of the Best Winner</span>' +
          '          <span class="tepa-bo-stage-desc">Grand spotlight reveal of the top-voted project and winning team.</span>' +
          '        </span>' +
          (s.stage_mode === 'winner_reveal' ? '<span class="tepa-bo-badge is-green">● Live Now</span>' : '') +
          '      </button>' +
          '    </div>' +
          '  </div>' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('sliders', 15) + '</span><h2 class="tepa-bo-card-title">Activity Gates &amp; Event Rules</h2></div>' +
          '        <p class="tepa-bo-card-desc">Open or close mobile participation anytime during the ceremony.</p>' +
          '      </div>' +
          '    </div>' +
          '    <div class="tepa-bo-gate-row">' +
          '      <div>' +
          '        <div class="tepa-bo-stage-title">Welcome Quiz Participation</div>' +
          '        <div class="tepa-bo-stage-desc">' + (s.quiz_open ? 'Participants can submit answers from mobile QR.' : 'Quiz intake is paused on mobile devices.') + '</div>' +
          '      </div>' +
          '      <label class="tepa-bo-switch" aria-label="Toggle Welcome Quiz Open">' +
          '        <input type="checkbox" class="tepa-bo-switch-input" data-action="toggle-setting" data-key="quiz_open" ' + (s.quiz_open ? 'checked' : '') + '>' +
          '        <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
          '      </label>' +
          '    </div>' +
          '    <div class="tepa-bo-gate-row">' +
          '      <div>' +
          '        <div class="tepa-bo-stage-title">Announce Quiz Winners on 16:9 Live Screen</div>' +
          '        <div class="tepa-bo-stage-desc">' + (s.reveal_quiz_winners ? 'Quiz winners are currently visible on the 16:9 auditorium screen.' : 'Winners are kept secret from players until you announce them on 16:9.') + '</div>' +
          '      </div>' +
          '      <label class="tepa-bo-switch" aria-label="Toggle Announce Quiz Winners on 16:9">' +
          '        <input type="checkbox" class="tepa-bo-switch-input" data-action="toggle-setting" data-key="reveal_quiz_winners" ' + (s.reveal_quiz_winners ? 'checked' : '') + '>' +
          '        <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
          '      </label>' +
          '    </div>' +
          '    <div class="tepa-bo-gate-row">' +
          '      <div>' +
          '        <div class="tepa-bo-stage-title">' + (k.isSimpleActivePoll ? 'Live Poll Voting Intake' : 'Final "Best of the Best" Voting') + '</div>' +
          '        <div class="tepa-bo-stage-desc">' + (s.voting_open ? 'Audience can cast 1 vote per device.' : 'Voting intake is locked on mobile devices.') + '</div>' +
          '      </div>' +
          '      <label class="tepa-bo-switch" aria-label="Toggle Voting Open">' +
          '        <input type="checkbox" class="tepa-bo-switch-input" data-action="toggle-setting" data-key="voting_open" ' + (s.voting_open ? 'checked' : '') + '>' +
          '        <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
          '      </label>' +
          '    </div>' +
          '    <form id="tepa-rules-form" style="margin-top:14px;padding-top:14px;border-top:1px solid #E2E8F0;">' +
          '      <div class="tepa-bo-field">' +
          '        <label class="tepa-bo-label" for="tepa-rule-title">Stage Event Headline</label>' +
          '        <input id="tepa-rule-title" class="tepa-bo-input" type="text" maxlength="100" value="' + esc(s.event_title || 'TEPA Performance Award 2026') + '">' +
          '      </div>' +
          '      <div class="tepa-bo-rules-grid">' +
          '        <div>' +
          '          <label class="tepa-bo-label" for="tepa-rule-minscore">Quiz Pass Score</label>' +
          '          <input id="tepa-rule-minscore" class="tepa-bo-input" type="number" min="1" max="20" value="' + esc((k.activeQuiz && k.activeQuiz.min_score) || s.min_quiz_score || 5) + '">' +
          '        </div>' +
          '        <div>' +
          '          <label class="tepa-bo-label" for="tepa-rule-maxv">Max Vouchers</label>' +
          '          <input id="tepa-rule-maxv" class="tepa-bo-input" type="number" min="1" max="100" value="' + esc(k.maxVouchers) + '">' +
          '        </div>' +
          '        <div>' +
          '          <button type="submit" class="tepa-bo-btn tepa-bo-btn-dark" style="height:40px;padding:0 18px;">' + icon('check', 14) + '<span>Save Rules</span></button>' +
          '        </div>' +
          '      </div>' +
          '    </form>' +
          '  </div>' +
          '</div>' +
          '<div class="tepa-bo-grid-2">' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('trophy', 15) + '</span><h2 class="tepa-bo-card-title">Live Top 5 Standings</h2></div>' +
          '        <p class="tepa-bo-card-desc">Real-time ranking across ' + (k.isSimpleActivePoll ? 'active poll options.' : 'active finalist projects.') + '</p>' +
          '      </div>' +
          '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-tab="projects"><span>' + (k.isSimpleActivePoll ? 'Manage Polls' : 'Manage Projects') + '</span>' + icon('arrowRight', 13) + '</button>' +
          '    </div>' +
          '    <div class="tepa-bo-leader-list">' +
          (top5.length
            ? top5.map(function (p, idx) {
                var v = Number(p.votes || 0);
                var pct = k.totalVotes > 0 ? Math.round((v / k.totalVotes) * 100) : 0;
                var w = k.totalVotes > 0 ? Math.max(4, Math.round((v / maxTopVotes) * 100)) : 2;
                var rankCls = idx < 3 ? ' is-' + (idx + 1) : '';
                return (
                  '<div class="tepa-bo-leader-row">' +
                  '  <div class="tepa-bo-leader-meta">' +
                  '    <div class="tepa-bo-leader-left">' +
                  '      <span class="tepa-bo-rank-pill' + rankCls + '">#' + (idx + 1) + '</span>' +
                  '      <div class="tepa-bo-leader-title-wrap"><strong>' + esc(p.project_title) + '</strong>' + (p.category_name ? ' <span style="color:#64748B;">· ' + esc(p.category_name) + '</span>' : '') + '</div>' +
                  '    </div>' +
                  '    <span class="tepa-bo-leader-votes-pill">' + v + ' <span style="color:#64748B;font-weight:500;">(' + pct + '%)</span></span>' +
                  '  </div>' +
                  '  <div class="tepa-bo-leader-bar"><div class="tepa-bo-leader-fill" data-target-pct="' + w + '" style="width:' + w + '%;background:' + barPalette[idx % barPalette.length] + ';"></div></div>' +
                  '</div>'
                );
              }).join('')
            : '<p style="color:#64748B;">No active options enabled.</p>') +
          '    </div>' +
          '  </div>' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('zap', 15) + '</span><h2 class="tepa-bo-card-title">Rehearsal &amp; Safe Event Reset</h2></div>' +
          '        <p class="tepa-bo-card-desc">Test live charts before doors open, then clear test data cleanly.</p>' +
          '      </div>' +
          '    </div>' +
          '    <div class="tepa-bo-sim-box">' +
          '      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:8px;display:flex;align-items:center;gap:6px;">' + icon('zap', 13) + '<span>Traffic Simulator (Rehearsal Testing)</span></div>' +
          '      <div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '        <button type="button" class="tepa-bo-btn tepa-bo-btn-dark" data-action="simulate-votes" data-count="5">' + icon('plus', 13) + '<span>5 Simulated Votes</span></button>' +
          '        <button type="button" class="tepa-bo-btn" data-action="simulate-votes" data-count="15">' + icon('plus', 13) + '<span>15 Simulated Votes</span></button>' +
          '      </div>' +
          '    </div>' +
          '    <div class="tepa-bo-danger-box">' +
          '      <div style="font-size:11.5px;font-weight:700;color:#991B1B;margin-bottom:8px;display:flex;align-items:center;gap:6px;">' + icon('refresh', 13) + '<span>Safe Non-Destructive Round Reset</span></div>' +
          '      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
          '        <button type="button" class="tepa-bo-btn tepa-bo-btn-danger" data-action="open-confirm-modal" data-modal-kind="reset" data-scope="votes">' + icon('refresh', 13) + '<span>Reset Votes to 0</span></button>' +
          '        <button type="button" class="tepa-bo-btn tepa-bo-btn-danger" data-action="open-confirm-modal" data-modal-kind="reset" data-scope="quiz">' + icon('refresh', 13) + '<span>Reset Quiz Entries</span></button>' +
          '      </div>' +
          '      <div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '        <button type="button" class="tepa-bo-btn tepa-bo-btn-danger" data-action="open-confirm-modal" data-modal-kind="reset" data-scope="all">' + icon('trash', 13) + '<span>Reset All Event Data (Go Live Clean)</span></button>' +
          (mode === 'demo'
            ? '<button type="button" class="tepa-bo-btn" data-action="open-confirm-modal" data-modal-kind="reset" data-scope="seed">' + icon('refresh', 13) + '<span>Restore Sample Demo Data</span></button>'
            : '') +
          '      </div>' +
          '      <p class="tepa-bo-hint" style="margin-top:8px;">Resetting increments the round epoch so rehearsal phones can vote or play again. Requires confirmation.</p>' +
          '    </div>' +
          '  </div>' +
          '</div>'
        );
      }

      if (state.tab === 'livescreen') {
        var curTheme = s.live_theme === 'dark' ? 'dark' : 'light';
        var curChart = s.live_chart_type === 'vertical' ? 'vertical' : 'horizontal';
        var curScope = s.live_vertical_scope === 'all15' ? 'all15' : 'top5';
        var curSort = s.live_sort_mode === 'slot' ? 'slot' : 'votes';
        var curShowQr = s.live_show_qr !== false;
        var curHideRes = Boolean(s.live_hide_results);
        var curStage = s.reveal_winner ? 'winner_reveal' : (s.stage_mode || 'live_voting');
        var curQuizReveal = Boolean(s.reveal_quiz_winners);
        var prizeTitleLs = (k.activeQuiz && k.activeQuiz.voucher_title) || 'Café Bonjour Breakfast Voucher';
        var evTitleVal = (state.pollCopyDraft && state.pollCopyDraft.event_title !== undefined)
          ? state.pollCopyDraft.event_title
          : (s.event_title || 'TEPA Performance Award 2026');
        var vHeadVal = (state.pollCopyDraft && state.pollCopyDraft.voting_headline !== undefined)
          ? state.pollCopyDraft.voting_headline
          : ((k.activePoll && k.activePoll.voting_headline) || s.voting_headline || 'Which finalist project deserves the Best of the Best?');

        var stageNameMap = {
          quiz_qr: 'Scene 1 · Welcome Quiz QR & Official Winners',
          live_voting: 'Scene 2 · Live Voting Ranking + QR',
          winner_reveal: k.isSimpleActivePoll ? 'Scene 3 · Winning Choice Spotlight' : 'Scene 3 · Best of the Best Winner Spotlight'
        };
        var monitorHeadline = curStage === 'quiz_qr'
          ? ((k.activeQuiz && k.activeQuiz.title && k.activeQuiz.title !== 'Quiz' ? k.activeQuiz.title : 'Welcome Quiz') + ' — Scan to Join & Win!')
          : (curStage === 'winner_reveal'
            ? (k.isSimpleActivePoll ? (vHeadVal || (k.activePoll && k.activePoll.title) || 'Poll Results') : (evTitleVal + ' — Best of the Best'))
            : vHeadVal);

        var monitorBodyHtml = '';
        if (curStage === 'quiz_qr') {
          monitorBodyHtml =
            '<div style="display:flex;align-items:center;gap:14px;">' +
            '  <div style="width:56px;height:56px;border-radius:12px;background:' + (curTheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#F1F5F9') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + icon('qr', 26) + '</div>' +
            '  <div style="min-width:0;flex:1;">' +
            '    <div style="font-size:12px;font-weight:700;color:#F77B39;">' + esc(k.subs.length) + ' Participants · ' + esc(k.voucherWinners.length) + ' / ' + esc(k.maxVouchers) + ' Qualified</div>' +
            '    <div style="font-size:12.5px;margin-top:3px;opacity:0.85;">' +
            (curQuizReveal
              ? ('● Showing ' + esc(k.voucherWinners.length) + ' official ' + esc(prizeTitleLs) + ' winners on screen')
              : '🔒 Winners list hidden on 16:9 screen (Awaiting Manager Reveal)') +
            '    </div>' +
            '  </div>' +
            '</div>';
        } else if (curStage === 'winner_reveal') {
          monitorBodyHtml =
            '<div style="padding:10px 14px;border-radius:12px;background:rgba(247,123,57,0.12);border:1px solid rgba(247,123,57,0.3);">' +
            '  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#F77B39;">' + (k.isSimpleActivePoll ? '★ Leading Poll Option' : '★ Best of the Best Spotlight') + '</div>' +
            '  <div style="font-size:15px;font-weight:800;margin-top:2px;">' + esc(k.leader ? k.leader.project_title : 'Waiting for votes...') + '</div>' +
            (k.leader ? '<div style="font-size:12px;opacity:0.8;margin-top:2px;">' + esc(k.leader.votes) + ' votes (' + esc(k.leaderPct) + '%)' + (k.leader.category_name ? (' · ' + esc(k.leader.category_name)) : '') + '</div>' : '') +
            '</div>';
        } else {
          var topPreview = k.sortedProjects.slice(0, 3);
          monitorBodyHtml =
            '<div style="display:flex;flex-direction:column;gap:6px;">' +
            topPreview.map(function (p, i) {
              var pv = Number(p.votes || 0);
              var ppct = (!curHideRes && k.totalVotes > 0) ? Math.round((pv / k.totalVotes) * 100) : 0;
              return (
                '<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;">' +
                '  <strong style="width:18px;">' + (i + 1) + '.</strong>' +
                '  <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(p.project_title) + '</span>' +
                '  <div style="width:90px;height:6px;border-radius:99px;background:rgba(148,163,184,0.22);overflow:hidden;"><div style="width:' + (curHideRes ? 15 : Math.max(8, ppct)) + '%;height:100%;background:#F77B39;border-radius:99px;"></div></div>' +
                '  <strong style="width:46px;text-align:right;">' + (curHideRes ? '••' : (pv + ' (' + ppct + '%)')) + '</strong>' +
                '</div>'
              );
            }).join('') +
            '</div>';
        }

        return (
          '<div class="tepa-bo-live-director-grid">' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('monitor', 15) + '</span><h2 class="tepa-bo-card-title">16:9 Auditorium Scene Switcher</h2></div>' +
          '        <p class="tepa-bo-card-desc">Click any scene below to switch the 16:9 big screen in real time.</p>' +
          '      </div>' +
          '      <a href="' + esc(liveScreenUrl) + '" target="_blank" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-primary">' + icon('external', 13) + '<span>Open 16:9 Screen</span></a>' +
          '    </div>' +
          '    <div class="tepa-bo-stage-list">' +
          '      <button type="button" class="tepa-bo-stage-card ' + (curStage === 'quiz_qr' ? 'is-active' : '') + '" data-action="set-stage" data-val="quiz_qr">' +
          '        <span class="tepa-bo-stage-num">' + icon('qr', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">Scene 1 · Welcome Quiz QR &amp; Official Winners</span>' +
          '          <span class="tepa-bo-stage-desc">Displays Quiz QR code, live participant counter (' + esc(k.subs.length) + '), and official winners reveal (' + (curQuizReveal ? 'ANNOUNCED' : 'HIDDEN') + ').</span>' +
          '        </span>' +
          (curStage === 'quiz_qr' ? '<span class="tepa-bo-badge is-green">● ON AIR</span>' : '') +
          '      </button>' +
          '      <button type="button" class="tepa-bo-stage-card ' + (curStage === 'live_voting' ? 'is-active' : '') + '" data-action="set-stage" data-val="live_voting">' +
          '        <span class="tepa-bo-stage-num">' + icon('barChart', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">Scene 2 · Live Voting Ranking + QR</span>' +
          '          <span class="tepa-bo-stage-desc">Mentimeter-style horizontal list or vertical columns across ' + esc(k.activeProjects.length) + (k.isSimpleActivePoll ? ' active options (' : ' active finalists (') + esc(k.totalVotes) + ' votes).</span>' +
          '        </span>' +
          (curStage === 'live_voting' ? '<span class="tepa-bo-badge is-green">● ON AIR</span>' : '') +
          '      </button>' +
          '      <button type="button" class="tepa-bo-stage-card ' + (curStage === 'winner_reveal' ? 'is-active' : '') + '" data-action="set-stage" data-val="winner_reveal">' +
          '        <span class="tepa-bo-stage-num">' + icon('trophy', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">' + (k.isSimpleActivePoll ? 'Scene 3 · Winning Choice Spotlight' : 'Scene 3 · Best of the Best Winner Spotlight') + '</span>' +
          '          <span class="tepa-bo-stage-desc">Grand reveal of #1 leader (' + esc(k.leader ? k.leader.project_title : 'No votes yet') + ') + runners-up.</span>' +
          '        </span>' +
          (curStage === 'winner_reveal' ? '<span class="tepa-bo-badge is-green">● ON AIR</span>' : '') +
          '      </button>' +
          '    </div>' +
          '  </div>' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('radio', 15) + '</span><h2 class="tepa-bo-card-title">Live 16:9 Stage Monitor</h2></div>' +
          '        <p class="tepa-bo-card-desc">Real-time mirror of the active auditorium projection state.</p>' +
          '      </div>' +
          '      <span class="tepa-bo-badge is-green">● Live Sync Active</span>' +
          '    </div>' +
          '    <div class="tepa-bo-monitor-frame is-' + curTheme + '">' +
          '      <div class="tepa-bo-monitor-top">' +
          '        <span class="tepa-bo-monitor-onair"><span class="tepa-bo-status-dot"></span> ON AIR · ' + esc(stageNameMap[curStage] || 'Live Stage') + '</span>' +
          '        <span class="tepa-bo-monitor-chip">' + (curTheme === 'dark' ? 'Dark Mode' : 'Light Mode') + '</span>' +
          '      </div>' +
          '      <div class="tepa-bo-monitor-body">' +
          '        <div class="tepa-bo-monitor-headline">' + esc(monitorHeadline) + '</div>' +
          monitorBodyHtml +
          '      </div>' +
          '      <div class="tepa-bo-monitor-chips">' +
          '        <span class="tepa-bo-monitor-chip">' + icon('barChart', 11) + '<span>Chart: ' + (curChart === 'vertical' ? ('Columns (' + (curScope === 'top5' ? 'Top 5' : 'All ' + k.activeProjects.length) + ')') : 'Ranked List') + '</span></span>' +
          '        <span class="tepa-bo-monitor-chip">' + icon('qr', 11) + '<span>Vote QR: ' + (curShowQr ? 'Visible' : 'Hidden') + '</span></span>' +
          '        <span class="tepa-bo-monitor-chip">' + icon(curHideRes ? 'eyeOff' : 'eye', 11) + '<span>Numbers: ' + (curHideRes ? 'Suspense (••)' : 'Visible') + '</span></span>' +
          '        <span class="tepa-bo-monitor-chip">' + icon('gift', 11) + '<span>Quiz Winners: ' + (curQuizReveal ? 'LIVE' : 'Secret') + '</span></span>' +
          '      </div>' +
          '    </div>' +
          '  </div>' +
          '</div>' +
          '<div class="tepa-bo-grid-2">' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('sliders', 15) + '</span><h2 class="tepa-bo-card-title">Remote Display &amp; Chart Controls (16:9)</h2></div>' +
          '        <p class="tepa-bo-card-desc">Change chart layout, theme, sorting, QR sidebar, and suspense mode remotely without touching the projector PC.</p>' +
          '      </div>' +
          '    </div>' +
          '    <div class="tepa-bo-ctrl-matrix">' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon('sun', 13) + '<span>1. Auditorium Theme</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curTheme === 'light' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_theme" data-val="light">' + icon('sun', 12) + '<span>Light</span></button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curTheme === 'dark' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_theme" data-val="dark">' + icon('moon', 12) + '<span>Dark</span></button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon('barChart', 13) + '<span>2. Voting Chart Style</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curChart === 'horizontal' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_chart_type" data-val="horizontal">' + icon('list', 12) + '<span>Ranked List</span></button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curChart === 'vertical' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_chart_type" data-val="vertical">' + icon('barChart', 12) + '<span>Columns</span></button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon('trophy', 13) + '<span>3. Vertical Columns Scope</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curScope === 'top5' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_vertical_scope" data-val="top5">Top 5 Leaders</button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curScope === 'all15' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_vertical_scope" data-val="all15">All ' + esc(k.activeProjects.length) + (k.isSimpleActivePoll ? ' Options' : ' Projects') + '</button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon('arrowDown', 13) + '<span>4. Poll / Project Sort Order</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curSort === 'votes' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_sort_mode" data-val="votes">By Most Votes</button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curSort === 'slot' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_sort_mode" data-val="slot">Original Order</button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon('qr', 13) + '<span>5. Voting QR Sidebar</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curShowQr ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_show_qr" data-val="true">Show QR Card</button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (!curShowQr ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_show_qr" data-val="false">Hide QR (Full Width)</button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon(curHideRes ? 'eyeOff' : 'eye', 13) + '<span>6. Suspense Mode (Vote Counts)</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (!curHideRes ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_hide_results" data-val="false">Show Live %</button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curHideRes ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_hide_results" data-val="true">Hide Results (••)</button>' +
          '        </div>' +
          '      </div>' +
          '    </div>' +
          '  </div>' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('gift', 15) + '</span><h2 class="tepa-bo-card-title">Live Ceremony Announcements &amp; Screen Headlines</h2></div>' +
          '        <p class="tepa-bo-card-desc">Reveal Quiz winners or winning poll result on the 16:9 screen with 1 click.</p>' +
          '      </div>' +
          '    </div>' +
          '    <div class="tepa-bo-reveal-banner ' + (curQuizReveal ? 'is-live' : 'is-hidden') + '" style="margin-bottom:12px;">' +
          '      <div style="min-width:0;flex:1;">' +
          '        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">' +
          '          <strong style="font-size:14px;color:#0F172A;">Quiz Winners Reveal on 16:9 Screen</strong>' +
          '          <span class="tepa-bo-badge ' + (curQuizReveal ? 'is-green' : 'is-gold') + '">' + (curQuizReveal ? '● LIVE ON 16:9' : 'HIDDEN / SECRET') + '</span>' +
          '        </div>' +
          '        <div style="font-size:12.5px;color:#475569;">' + esc(k.voucherWinners.length) + ' of ' + esc(k.maxVouchers) + ' ' + esc(prizeTitleLs) + ' winners ready to announce.</div>' +
          '      </div>' +
          '      <button type="button" class="tepa-bo-btn ' + (curQuizReveal ? 'tepa-bo-btn-dark' : 'tepa-bo-btn-primary') + '" data-action="announce-quiz-winners" data-val="' + (!curQuizReveal) + '">' +
          icon('radio', 14) + '<span>' + (curQuizReveal ? 'Hide Quiz Winners' : 'Announce Quiz Winners Now') + '</span></button>' +
          '    </div>' +
          '    <div class="tepa-bo-reveal-banner ' + (curStage === 'winner_reveal' ? 'is-live' : '') + '" style="margin-bottom:16px;">' +
          '      <div style="min-width:0;flex:1;">' +
          '        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">' +
          '          <strong style="font-size:14px;color:#0F172A;">' + (k.isSimpleActivePoll ? 'Winning Poll Option Spotlight Reveal' : 'Best of the Best Grand Winner Reveal') + '</strong>' +
          '          <span class="tepa-bo-badge ' + (curStage === 'winner_reveal' ? 'is-green' : 'is-blue') + '">' + (curStage === 'winner_reveal' ? '● ON AIR' : 'STANDBY') + '</span>' +
          '        </div>' +
          '        <div style="font-size:12.5px;color:#475569;">Current #1: <strong>' + esc(k.leader ? k.leader.project_title : 'No votes yet') + '</strong>' + (k.leader ? (' (' + esc(k.leader.votes) + ' votes · ' + esc(k.leaderPct) + '%)') : '') + '</div>' +
          '      </div>' +
          '      <button type="button" class="tepa-bo-btn ' + (curStage === 'winner_reveal' ? 'tepa-bo-btn-dark' : 'tepa-bo-btn-primary') + '" data-action="set-stage" data-val="' + (curStage === 'winner_reveal' ? 'live_voting' : 'winner_reveal') + '">' +
          icon('trophy', 14) + '<span>' + (curStage === 'winner_reveal' ? 'Back to Voting Chart' : (k.isSimpleActivePoll ? 'Reveal Winning Option' : 'Reveal Best of the Best')) + '</span></button>' +
          '    </div>' +
          '    <form id="tepa-live-headlines-form" style="padding-top:12px;border-top:1px solid #E2E8F0;">' +
          '      <div class="tepa-bo-field">' +
          '        <label class="tepa-bo-label" for="tepa-ls-ev-title">16:9 Ceremony Title (Scene 3 Winner Spotlight)</label>' +
          '        <input id="tepa-ls-ev-title" class="tepa-bo-input" type="text" maxlength="100" value="' + esc(evTitleVal) + '">' +
          '      </div>' +
          '      <div class="tepa-bo-rules-grid" style="grid-template-columns:1fr auto;">' +
          '        <div>' +
          '          <label class="tepa-bo-label" for="tepa-ls-v-head">16:9 Voting Poll Question Headline (Scene 2)</label>' +
          '          <input id="tepa-ls-v-head" class="tepa-bo-input" type="text" maxlength="160" value="' + esc(vHeadVal) + '">' +
          '        </div>' +
          '        <div>' +
          '          <button type="submit" class="tepa-bo-btn tepa-bo-btn-dark" style="height:40px;padding:0 18px;">' + icon('check', 14) + '<span>Update Screen Titles</span></button>' +
          '        </div>' +
          '      </div>' +
          '    </form>' +
          '  </div>' +
          '</div>'
        );
      }

      if (state.tab === 'questions') {
        var selQuiz = ensureSelectedQuiz(state.data);
        var qDraft = getQuizDraft(selQuiz);
        var selQs = selQuiz
          ? allQs.filter(function (q) { return !q.quiz_id || q.quiz_id === selQuiz.id; })
          : allQs;
        var dirtyQCount = selQs.filter(function (q) { return Boolean(state.dirtyQuestions[q.id]); }).length;
        var isLiveQuiz = Boolean(selQuiz && s.active_quiz_id === selQuiz.id);

        var pillsHtml = quizzes.map(function (qz) {
          var isSel = selQuiz && qz.id === selQuiz.id;
          var isLive = s.active_quiz_id === qz.id;
          var qCnt = allQs.filter(function (q) { return q.quiz_id === qz.id; }).length;
          return (
            '<button type="button" class="tepa-bo-quiz-pill ' + (isSel ? 'is-active' : '') + '" data-action="select-quiz" data-id="' + esc(qz.id) + '">' +
            '  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;">' +
            '    <strong style="font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(qz.title) + '</strong>' +
            (isLive ? '<span class="tepa-bo-badge is-green">LIVE</span>' : '<span class="tepa-bo-badge is-muted">Draft</span>') +
            '  </div>' +
            '  <span style="font-size:11.5px;color:#64748B;">' + qCnt + ' question' + (qCnt === 1 ? '' : 's') + ' · Min ' + esc(qz.min_score || 5) + '</span>' +
            '</button>'
          );
        }).join('') +
        '<button type="button" class="tepa-bo-quiz-pill is-new" data-action="create-quiz">' + icon('plus', 15) + '<span>Create New Quiz</span></button>';

        var qCardsHtml = selQs.length
          ? selQs.map(function (orig, idx) {
              var q = getQuestionDraft(orig);
              var isDirty = Boolean(state.dirtyQuestions[orig.id]);
              var isMc = q.question_type === 'multiple_choice';
              var opts = isMc ? (q.options && q.options.length >= 2 ? q.options : ['Option A', 'Option B', 'Option C']) : [];
              var isTrue = Boolean(q.correct_answer);

              var answerBuilder = isMc
                ? '<div class="tepa-bo-opt-list">' +
                  opts.map(function (optText, optIdx) {
                    var isCorrect = Number(q.correct_option || 0) === optIdx;
                    return (
                      '<div class="tepa-bo-opt-row">' +
                      '  <button type="button" class="tepa-bo-opt-radio ' + (isCorrect ? 'is-correct' : '') + '" data-action="set-q-correct-opt" data-id="' + orig.id + '" data-opt-idx="' + optIdx + '" title="Mark correct answer">' +
                      (LETTERS[optIdx] || (optIdx + 1)) +
                      '  </button>' +
                      '  <input class="tepa-bo-input" style="height:36px;min-height:36px;" data-opt-idx="' + optIdx + '" value="' + esc(optText) + '" placeholder="Answer option ' + (LETTERS[optIdx] || (optIdx + 1)) + '">' +
                      '  <button type="button" class="tepa-bo-icon-btn is-danger" data-action="remove-q-opt" data-id="' + orig.id + '" data-opt-idx="' + optIdx + '" ' + (opts.length <= 2 ? 'disabled' : '') + ' title="Remove option">' + icon('x', 13) + '</button>' +
                      '</div>'
                    );
                  }).join('') +
                  (opts.length < 4
                    ? '<div><button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="add-q-opt" data-id="' + orig.id + '">' + icon('plus', 12) + '<span>Add Option</span></button> <span class="tepa-bo-hint" style="display:inline;margin-left:6px;">Click letter A/B/C/D to mark the right answer</span></div>'
                    : '<div class="tepa-bo-hint">Click letter badge (A–D) to set the correct answer.</div>') +
                  '</div>'
                : '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
                  '  <span class="tepa-bo-label" style="margin:0;">Correct Answer:</span>' +
                  '  <div class="tepa-bo-seg" style="width:170px;">' +
                  '    <button type="button" class="tepa-bo-seg-btn is-yes ' + (isTrue ? 'is-active' : '') + '" data-action="set-q-ans" data-id="' + orig.id + '" data-val="true">Yes</button>' +
                  '    <button type="button" class="tepa-bo-seg-btn is-no ' + (!isTrue ? 'is-active' : '') + '" data-action="set-q-ans" data-id="' + orig.id + '" data-val="false">No</button>' +
                  '  </div>' +
                  '</div>';

              return (
                '<div class="tepa-bo-q-card ' + (isDirty ? 'is-dirty' : '') + '" data-q-row="' + orig.id + '">' +
                '  <div class="tepa-bo-q-card-top">' +
                '    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                '      <span class="tepa-bo-slot-pill" style="background:#2194D4;">Q' + pad2(idx + 1) + '</span>' +
                '      <button type="button" class="tepa-bo-icon-btn" data-action="move-question" data-id="' + orig.id + '" data-dir="-1" ' + (idx === 0 ? 'disabled' : '') + ' title="Move Up">' + icon('arrowUp', 13) + '</button>' +
                '      <button type="button" class="tepa-bo-icon-btn" data-action="move-question" data-id="' + orig.id + '" data-dir="1" ' + (idx === selQs.length - 1 ? 'disabled' : '') + ' title="Move Down">' + icon('arrowDown', 13) + '</button>' +
                '      <div class="tepa-bo-seg">' +
                '        <button type="button" class="tepa-bo-seg-btn ' + (!isMc ? 'is-active' : '') + '" data-action="set-q-type" data-id="' + orig.id + '" data-qtype="yes_no">Yes / No</button>' +
                '        <button type="button" class="tepa-bo-seg-btn ' + (isMc ? 'is-active' : '') + '" data-action="set-q-type" data-id="' + orig.id + '" data-qtype="multiple_choice">Multiple Choice</button>' +
                '      </div>' +
                '    </div>' +
                '    <div style="display:flex;align-items:center;gap:8px;">' +
                '      <label class="tepa-bo-switch is-sm" title="Include in Quiz">' +
                '        <input type="checkbox" class="tepa-bo-switch-input" data-field="is_active" ' + (q.is_active !== false ? 'checked' : '') + '>' +
                '        <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
                '      </label>' +
                '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm ' + (isDirty ? 'tepa-bo-btn-dark' : '') + '" data-action="save-question" data-id="' + orig.id + '">' + icon('check', 12) + '<span>Save</span></button>' +
                '      <button type="button" class="tepa-bo-icon-btn is-danger" data-action="open-confirm-modal" data-modal-kind="archive_question" data-id="' + orig.id + '" title="Delete Question">' + icon('trash', 13) + '</button>' +
                '    </div>' +
                '  </div>' +
                '  <div class="tepa-bo-q-body">' +
                '    <input class="tepa-bo-input" data-field="question_text" value="' + esc(q.question_text) + '" placeholder="Type your quiz question...">' +
                answerBuilder +
                '  </div>' +
                '</div>'
              );
            }).join('')
          : '<div style="padding:24px;text-align:center;color:#64748B;border:1px dashed #CBD5E1;border-radius:12px;">No questions yet. Add a Yes/No or Multiple Choice question above.</div>';

        return (
          '<div class="tepa-bo-quiz-pills">' + pillsHtml + '</div>' +
          '<div class="tepa-bo-studio-layout">' +
          '  <div style="display:flex;flex-direction:column;gap:16px;min-width:0;">' +
          (qDraft
            ? '<div class="tepa-bo-card">' +
              '  <div class="tepa-bo-card-head">' +
              '    <div>' +
              '      <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('sliders', 15) + '</span><h2 class="tepa-bo-card-title">Quiz Setup &amp; Reward Settings</h2></div>' +
              '      <p class="tepa-bo-card-desc">Customize the cover screen, passing threshold, and prize rules for this quiz.</p>' +
              '    </div>' +
              '    <div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              (!isLiveQuiz
                ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-primary" data-action="activate-quiz" data-id="' + esc(qDraft.id) + '" data-reset="false">' + icon('radio', 13) + '<span>Set Live</span></button>' +
                  '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-dark" data-action="activate-quiz" data-id="' + esc(qDraft.id) + '" data-reset="true">' + icon('refresh', 13) + '<span>Set Live + New Round</span></button>'
                : '<span class="tepa-bo-badge is-green" style="height:31px;padding:0 12px;">● Currently Live on Mobile</span>') +
              '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="duplicate-quiz" data-id="' + esc(qDraft.id) + '">' + icon('copy', 12) + '<span>Duplicate</span></button>' +
              (quizzes.length > 1
                ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-danger" data-action="open-confirm-modal" data-modal-kind="archive_quiz" data-id="' + esc(qDraft.id) + '">' + icon('trash', 12) + '<span>Delete</span></button>'
                : '') +
              '    </div>' +
              '  </div>' +
              '  <form id="tepa-quiz-meta-form" data-quiz-id="' + esc(qDraft.id) + '">' +
              '    <div class="tepa-bo-form-row" style="margin-bottom:12px;">' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-qm-title">Quiz Title</label>' +
              '        <input id="tepa-qm-title" class="tepa-bo-input" data-qmeta="title" type="text" maxlength="80" value="' + esc(qDraft.title) + '" required>' +
              '      </div>' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-qm-qpp">Questions per Mobile Page</label>' +
              '        <select id="tepa-qm-qpp" class="tepa-bo-select" data-qmeta="questions_per_page">' +
              [1, 2, 4, 6, 10].map(function (n) {
                var sel = Number(qDraft.questions_per_page || 2) === n ? 'selected' : '';
                return '<option value="' + n + '" ' + sel + '>' + (n === 10 ? 'All on 1 Page (up to 10)' : n + ' per screen') + '</option>';
              }).join('') +
              '        </select>' +
              '      </div>' +
              '    </div>' +
              '    <div class="tepa-bo-field">' +
              '      <label class="tepa-bo-label" for="tepa-qm-sub">Mobile Cover Description</label>' +
              '      <input id="tepa-qm-sub" class="tepa-bo-input" data-qmeta="subtitle" type="text" maxlength="220" value="' + esc(qDraft.subtitle || '') + '">' +
              '    </div>' +
              '    <div class="tepa-bo-gate-row" style="margin-bottom:12px;">' +
              '      <div>' +
              '        <div class="tepa-bo-stage-title">Enable Voucher / Prize Winners</div>' +
              '        <div class="tepa-bo-stage-desc">Automatically reward the first qualifying participants.</div>' +
              '      </div>' +
              '      <label class="tepa-bo-switch">' +
              '        <input type="checkbox" class="tepa-bo-switch-input" data-qmeta="voucher_enabled" ' + (qDraft.voucher_enabled !== false ? 'checked' : '') + '>' +
              '        <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
              '      </label>' +
              '    </div>' +
              '    <div class="tepa-bo-form-row">' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-qm-vtitle">Prize / Voucher Name</label>' +
              '        <input id="tepa-qm-vtitle" class="tepa-bo-input" data-qmeta="voucher_title" type="text" value="' + esc(qDraft.voucher_title || 'Café Bonjour Breakfast Voucher') + '">' +
              '      </div>' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-qm-min">Min Passing Score</label>' +
              '        <input id="tepa-qm-min" class="tepa-bo-input" data-qmeta="min_score" type="number" min="1" max="50" value="' + esc(qDraft.min_score || 5) + '">' +
              '      </div>' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-qm-maxv">Max Winners</label>' +
              '        <input id="tepa-qm-maxv" class="tepa-bo-input" data-qmeta="max_vouchers" type="number" min="1" max="200" value="' + esc(qDraft.max_vouchers || 10) + '">' +
              '      </div>' +
              '      <div>' +
              '        <button type="submit" class="tepa-bo-btn tepa-bo-btn-dark" style="width:100%;height:40px;">' + icon('check', 14) + '<span>Save Quiz Settings</span></button>' +
              '      </div>' +
              '    </div>' +
              '  </form>' +
              '</div>'
            : '') +
          '    <div class="tepa-bo-card">' +
          '      <div class="tepa-bo-toolbar">' +
          '        <div>' +
          '          <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('sparkles', 15) + '</span><h2 class="tepa-bo-card-title">Quiz Questions (' + selQs.length + ')</h2></div>' +
          '          <p class="tepa-bo-card-desc">Add unlimited Yes/No or Multiple Choice questions, reorder, and preview live.</p>' +
          '        </div>' +
          '        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '          <span data-dirty-q-badge class="tepa-bo-badge ' + (dirtyQCount ? 'is-gold' : 'is-green') + '">' + (dirtyQCount ? (dirtyQCount + ' unsaved edit' + (dirtyQCount > 1 ? 's' : '')) : 'All synced') + '</span>' +
          '          <button type="button" class="tepa-bo-btn" data-action="discard-questions" style="' + (dirtyQCount ? '' : 'display:none;') + '">Discard</button>' +
          '          <button type="button" class="tepa-bo-btn" data-action="create-question" data-qtype="yes_no">' + icon('plus', 13) + '<span>Yes / No</span></button>' +
          '          <button type="button" class="tepa-bo-btn" data-action="create-question" data-qtype="multiple_choice">' + icon('plus', 13) + '<span>Multiple Choice</span></button>' +
          '          <button type="button" class="tepa-bo-btn tepa-bo-btn-primary" data-action="save-all-questions" ' + (state.saving ? 'disabled' : '') + '>' + icon('check', 14) + '<span>Save All Questions</span></button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-q-list">' + qCardsHtml + '</div>' +
          '    </div>' +
          '  </div>' +
          '  <aside class="tepa-bo-phone-sticky">' +
          '    <div class="tepa-bo-card">' +
          '      <div class="tepa-bo-card-head" style="margin-bottom:10px;">' +
          '        <div>' +
          '          <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('smartphone', 14) + '</span><h3 class="tepa-bo-card-title" style="font-size:14.5px;">Live Mobile Preview</h3></div>' +
          '          <p class="tepa-bo-card-desc">Updates as you type</p>' +
          '        </div>' +
          '        <div class="tepa-bo-seg" style="width:154px;">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (state.previewScreen === 'cover' ? 'is-active' : '') + '" data-preview-mode="cover">Cover</button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (state.previewScreen === 'questions' ? 'is-active' : '') + '" data-preview-mode="questions">Question</button>' +
          '        </div>' +
          '      </div>' +
          '      <div id="tepa-bo-phone-qpills-slot">' + buildPhoneQPillsHtml() + '</div>' +
          '      <div class="tepa-bo-phone-frame">' +
          '        <div id="tepa-bo-phone-preview-body" style="flex:1;display:flex;flex-direction:column;">' + buildPhonePreviewHtml() + '</div>' +
          '        <div class="tepa-bo-phone-footer"><img src="' + esc(assetUrl('totalenergies-logo.png')) + '" alt="TotalEnergies"></div>' +
          '      </div>' +
          '    </div>' +
          '  </aside>' +
          '</div>'
        );
      }

      if (state.tab === 'projects') {
        var polls = k.polls || [];
        var selPoll = ensureSelectedPoll(state.data);
        var pDraft = getPollDraft(selPoll);
        var isLivePoll = Boolean(selPoll && s.active_poll_id === selPoll.id);
        var isSimple = Boolean(pDraft && pDraft.poll_type === 'simple');
        var pollProjects = selPoll
          ? projects.filter(function (p) { return !p.poll_id || p.poll_id === selPoll.id; })
          : projects;
        var pollTotalVotes = pollProjects
          .filter(function (orig) { return getProjectDraft(orig).is_active !== false; })
          .reduce(function (acc, orig) { return acc + (Number(orig.votes) || 0); }, 0);

        var dirtyProjCount = Object.keys(state.dirtyProjects).length;
        var activeCnt = pollProjects.filter(function (orig) { return getProjectDraft(orig).is_active !== false; }).length;
        var hiddenCnt = pollProjects.length - activeCnt;
        var pNeedle = state.projSearch.trim().toLowerCase();

        var filteredProjects = pollProjects.filter(function (orig) {
          var p = getProjectDraft(orig);
          var isAct = p.is_active !== false;
          if (state.projFilter === 'active' && !isAct) return false;
          if (state.projFilter === 'hidden' && isAct) return false;
          if (!pNeedle) return true;
          return (
            String(p.category_name || '').toLowerCase().indexOf(pNeedle) !== -1 ||
            String(p.project_title || '').toLowerCase().indexOf(pNeedle) !== -1 ||
            String(p.team_name || '').toLowerCase().indexOf(pNeedle) !== -1
          );
        });

        var pollPillsHtml = polls.map(function (pl) {
          var isSel = selPoll && pl.id === selPoll.id;
          var isLive = s.active_poll_id === pl.id;
          var optCnt = projects.filter(function (p) { return !p.poll_id || p.poll_id === pl.id; }).length;
          var fmtLbl = pl.poll_type === 'simple' ? 'Simple Poll' : 'Projects';
          return (
            '<button type="button" class="tepa-bo-quiz-pill ' + (isSel ? 'is-active' : '') + '" data-action="select-poll" data-id="' + esc(pl.id) + '">' +
            '  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;">' +
            '    <strong style="font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(pl.title) + '</strong>' +
            (isLive ? '<span class="tepa-bo-badge is-green">LIVE</span>' : '<span class="tepa-bo-badge is-muted">Draft</span>') +
            '  </div>' +
            '  <span style="font-size:11.5px;color:#64748B;">' + optCnt + ' ' + (pl.poll_type === 'simple' ? 'option' : 'project') + (optCnt === 1 ? '' : 's') + ' · ' + fmtLbl + '</span>' +
            '</button>'
          );
        }).join('') +
        '<button type="button" class="tepa-bo-quiz-pill is-new" data-action="create-poll" data-polltype="simple">' + icon('plus', 15) + '<span>Create New Poll</span></button>';

        var projRows = filteredProjects.map(function (orig, idx) {
          var p = getProjectDraft(orig);
          var isDirty = Boolean(state.dirtyProjects[orig.id]);
          var isAct = p.is_active !== false;
          var v = Number(orig.votes || 0);
          var pct = (isAct && pollTotalVotes > 0) ? Math.round((v / pollTotalVotes) * 100) : 0;
          return (
            '<div class="tepa-bo-proj-row ' + (isSimple ? 'is-simple ' : '') + (isDirty ? 'is-dirty' : '') + ' ' + (!isAct ? 'is-inactive' : '') + '" data-proj-row="' + orig.id + '">' +
            '  <div class="tepa-bo-slot-group">' +
            '    <span class="tepa-bo-slot-pill">#' + pad2(orig.slot_number) + '</span>' +
            '    <button type="button" class="tepa-bo-icon-btn" data-action="move-project" data-id="' + orig.id + '" data-dir="-1" ' + (idx === 0 ? 'disabled' : '') + ' title="Move Up">' + icon('arrowUp', 13) + '</button>' +
            '    <button type="button" class="tepa-bo-icon-btn" data-action="move-project" data-id="' + orig.id + '" data-dir="1" ' + (idx === filteredProjects.length - 1 ? 'disabled' : '') + ' title="Move Down">' + icon('arrowDown', 13) + '</button>' +
            '  </div>' +
            (isSimple ? '' : '  <input class="tepa-bo-input" data-field="category_name" value="' + esc(p.category_name || '') + '" placeholder="Category">') +
            '  <input class="tepa-bo-input" data-field="project_title" value="' + esc(p.project_title) + '" placeholder="' + (isSimple ? 'Option label (shown on 16:9 & mobile)' : 'Project Title') + '">' +
            (isSimple ? '' : '  <input class="tepa-bo-input" data-field="team_name" value="' + esc(p.team_name || '') + '" placeholder="Team / Dept">') +
            '  <div class="tepa-bo-votes-col">' +
            '    <div class="tepa-bo-votes-pill">' + v + ' <span style="color:#64748B;font-weight:500;">(' + (isAct ? (pct + '%') : 'Hidden') + ')</span></div>' +
            '    <div class="tepa-bo-proj-bar-track"><div class="tepa-bo-proj-bar-fill" data-target-pct="' + Math.max(v > 0 && isAct ? 4 : 0, pct) + '" style="width:' + pct + '%;"></div></div>' +
            '  </div>' +
            '  <label class="tepa-bo-switch is-sm" title="Show on Voting Screen">' +
            '    <input type="checkbox" class="tepa-bo-switch-input" data-field="is_active" ' + (isAct ? 'checked' : '') + '>' +
            '    <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
            '  </label>' +
            '  <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">' +
            '    <button type="button" class="tepa-bo-btn tepa-bo-btn-sm ' + (isDirty ? 'tepa-bo-btn-dark' : '') + '" data-action="save-project" data-id="' + orig.id + '">' + icon('check', 12) + '<span>Save</span></button>' +
            '    <button type="button" class="tepa-bo-icon-btn is-danger" data-action="open-confirm-modal" data-modal-kind="archive_project" data-id="' + orig.id + '" title="Remove Option">' + icon('trash', 13) + '</button>' +
            '  </div>' +
            '</div>'
          );
        }).join('');

        return (
          '<div class="tepa-bo-quiz-pills">' + pollPillsHtml + '</div>' +
          (pDraft
            ? '<div class="tepa-bo-card" style="margin-bottom:16px;">' +
              '  <div class="tepa-bo-card-head">' +
              '    <div>' +
              '      <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('sliders', 15) + '</span><h2 class="tepa-bo-card-title">Voting Poll Setup &amp; Format</h2></div>' +
              '      <p class="tepa-bo-card-desc">Switch between multi-event Simple Polls or Full Finalist Projects, and activate any poll live on 16:9 &amp; mobile.</p>' +
              '    </div>' +
              '    <div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              (!isLivePoll
                ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-primary" data-action="activate-poll" data-id="' + esc(pDraft.id) + '" data-reset="false">' + icon('radio', 13) + '<span>Set Live</span></button>' +
                  '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-dark" data-action="activate-poll" data-id="' + esc(pDraft.id) + '" data-reset="true">' + icon('refresh', 13) + '<span>Set Live + New Round</span></button>'
                : '<span class="tepa-bo-badge is-green" style="height:31px;padding:0 12px;">● Currently Live on Stage &amp; Mobile</span>') +
              '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="duplicate-poll" data-id="' + esc(pDraft.id) + '">' + icon('copy', 12) + '<span>Duplicate</span></button>' +
              (polls.length > 1
                ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-danger" data-action="open-confirm-modal" data-modal-kind="archive_poll" data-id="' + esc(pDraft.id) + '">' + icon('trash', 12) + '<span>Delete</span></button>'
                : '') +
              '    </div>' +
              '  </div>' +
              '  <form id="tepa-poll-meta-form" data-poll-id="' + esc(pDraft.id) + '">' +
              '    <div class="tepa-bo-form-row" style="margin-bottom:12px;">' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-pm-title">Poll Name (Admin Studio)</label>' +
              '        <input id="tepa-pm-title" class="tepa-bo-input" data-pmeta="title" type="text" maxlength="100" value="' + esc(pDraft.title || '') + '" required>' +
              '      </div>' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-pm-type">Option Display Format</label>' +
              '        <select id="tepa-pm-type" class="tepa-bo-select" data-pmeta="poll_type">' +
              '          <option value="simple" ' + (isSimple ? 'selected' : '') + '>Simple Poll Options (Text Only · Mentimeter style)</option>' +
              '          <option value="projects" ' + (!isSimple ? 'selected' : '') + '>Finalist Projects (Category + Title + Team)</option>' +
              '        </select>' +
              '      </div>' +
              '    </div>' +
              '    <div class="tepa-bo-form-row">' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-pm-head">16:9 Stage Question Headline</label>' +
              '        <input id="tepa-pm-head" class="tepa-bo-input" data-pmeta="voting_headline" type="text" maxlength="160" value="' + esc(pDraft.voting_headline || '') + '">' +
              '      </div>' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-pm-sub">Mobile Cover Subtitle (use · to split lines)</label>' +
              '        <input id="tepa-pm-sub" class="tepa-bo-input" data-pmeta="voting_subtitle" type="text" maxlength="180" value="' + esc(pDraft.voting_subtitle || '') + '">' +
              '      </div>' +
              '      <div style="max-width:190px;">' +
              '        <button type="submit" class="tepa-bo-btn tepa-bo-btn-dark" style="width:100%;height:40px;">' + icon('check', 14) + '<span>Save Poll Settings</span></button>' +
              '      </div>' +
              '    </div>' +
              '  </form>' +
              '</div>'
            : '') +
          '<div class="tepa-bo-card">' +
          '  <div class="tepa-bo-toolbar">' +
          '    <div>' +
          '      <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('trophy', 15) + '</span><h2 class="tepa-bo-card-title">' + (isSimple ? 'Poll Options' : 'Finalist Projects') + ' (' + pollProjects.length + ')</h2></div>' +
          '      <p class="tepa-bo-card-desc">' + activeCnt + ' active on 16:9 stage &amp; mobile voting · ' + hiddenCnt + ' hidden.</p>' +
          '    </div>' +
          '    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '      <span data-dirty-proj-badge class="tepa-bo-badge ' + (dirtyProjCount ? 'is-gold' : 'is-green') + '">' + (dirtyProjCount ? (dirtyProjCount + ' unsaved edit' + (dirtyProjCount > 1 ? 's' : '')) : 'All synced') + '</span>' +
          '      <button type="button" class="tepa-bo-btn" data-action="discard-projects" style="' + (dirtyProjCount ? '' : 'display:none;') + '">Discard</button>' +
          (hiddenCnt > 0 ? '<button type="button" class="tepa-bo-btn" data-action="enable-all-projects">' + icon('check', 13) + '<span>Enable All (' + pollProjects.length + ')</span></button>' : '') +
          '      <button type="button" class="tepa-bo-btn" data-action="create-project">' + icon('plus', 13) + '<span>' + (isSimple ? 'Add Option' : 'Add Project') + '</span></button>' +
          '      <button type="button" class="tepa-bo-btn tepa-bo-btn-primary" data-action="save-all-projects" ' + (state.saving ? 'disabled' : '') + '>' + icon('check', 14) + '<span>' + (isSimple ? 'Save All Options' : 'Save All Projects') + '</span></button>' +
          '    </div>' +
          '  </div>' +
          '  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;">' +
          '    <div class="tepa-bo-filter-pills">' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.projFilter === 'all' ? 'is-active' : '') + '" data-projfilter="all">All (' + pollProjects.length + ')</button>' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.projFilter === 'active' ? 'is-active' : '') + '" data-projfilter="active">Active on Stage (' + activeCnt + ')</button>' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.projFilter === 'hidden' ? 'is-active' : '') + '" data-projfilter="hidden">Hidden (' + hiddenCnt + ')</button>' +
          '    </div>' +
          '    <input id="tepa-proj-search" class="tepa-bo-input" style="width:240px;height:34px;min-height:34px;" type="search" placeholder="' + (isSimple ? 'Filter options...' : 'Filter by category, title, team...') + '" value="' + esc(state.projSearch) + '">' +
          '  </div>' +
          '  <div class="tepa-bo-proj-head' + (isSimple ? ' is-simple' : '') + '">' +
          (isSimple
            ? '    <span>Order</span><span>Option Label</span><span style="text-align:right;">Votes &amp; %</span><span>Active</span><span style="text-align:right;">Actions</span>'
            : '    <span>Order</span><span>Category</span><span>Project Title</span><span>Team</span><span style="text-align:right;">Votes &amp; %</span><span>Active</span><span style="text-align:right;">Actions</span>') +
          '  </div>' +
          '  <div class="tepa-bo-proj-list">' + (projRows || '<p style="text-align:center;padding:24px;color:#64748B;">No poll options match this filter.</p>') + '</div>' +
          '</div>'
        );
      }

      if (state.tab === 'submissions') {
        var winSubs = subs.filter(function (x) { return x.is_voucher_winner; });
        var pendingSubs = winSubs.filter(function (x) { return !x.voucher_claimed; });
        var redeemedSubs = winSubs.filter(function (x) { return x.voucher_claimed; });

        var needle = state.search.trim().toLowerCase();
        var filteredSubs = subs.filter(function (row) {
          if (state.subFilter === 'winners' && !row.is_voucher_winner) return false;
          if (state.subFilter === 'pending' && !(row.is_voucher_winner && !row.voucher_claimed)) return false;
          if (state.subFilter === 'redeemed' && !(row.is_voucher_winner && row.voucher_claimed)) return false;
          if (!needle) return true;
          return (
            String(row.full_name || '').toLowerCase().indexOf(needle) !== -1 ||
            String(row.unique_code || '').toLowerCase().indexOf(needle) !== -1
          );
        });

        return (
          '<div class="tepa-bo-card">' +
          '  <div class="tepa-bo-toolbar">' +
          '    <div class="tepa-bo-filter-pills">' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.subFilter === 'all' ? 'is-active' : '') + '" data-subfilter="all">All (' + subs.length + ')</button>' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.subFilter === 'winners' ? 'is-active' : '') + '" data-subfilter="winners">Top ' + k.maxVouchers + ' Winners (' + winSubs.length + ')</button>' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.subFilter === 'pending' ? 'is-active' : '') + '" data-subfilter="pending">Pending Voucher (' + pendingSubs.length + ')</button>' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.subFilter === 'redeemed' ? 'is-active' : '') + '" data-subfilter="redeemed">Redeemed (' + redeemedSubs.length + ')</button>' +
          '    </div>' +
          '    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '      <input id="tepa-admin-search" class="tepa-bo-input" style="width:230px;" type="search" placeholder="Search name or TEPA-XXXXXX..." value="' + esc(state.search) + '">' +
          '      <button type="button" class="tepa-bo-btn ' + (s.reveal_quiz_winners ? 'tepa-bo-btn-success' : 'tepa-bo-btn-primary') + '" data-action="announce-quiz-winners" data-val="' + (!s.reveal_quiz_winners) + '">' +
          icon('radio', 14) + '<span>' + (s.reveal_quiz_winners ? 'Winners Live on 16:9 (Hide)' : 'Announce Winners on 16:9 Screen') + '</span></button>' +
          '      <button type="button" class="tepa-bo-btn tepa-bo-btn-dark" data-action="export-csv">' + icon('download', 14) + '<span>Export CSV</span></button>' +
          '    </div>' +
          '  </div>' +
          '  <div class="tepa-bo-table-wrap"><table class="tepa-bo-table">' +
          '    <thead><tr><th>Rank</th><th>Participant Name</th><th>Unique ID</th><th>Score</th><th>Status</th><th>Time</th><th>Prize Desk</th></tr></thead>' +
          '    <tbody>' +
          (filteredSubs.length
            ? filteredSubs.map(function (r) {
                return (
                  '<tr>' +
                  '  <td>' + (r.winner_rank ? '<span class="tepa-bo-badge is-gold">#' + r.winner_rank + '</span>' : '<span style="color:#94A3B8;">—</span>') + '</td>' +
                  '  <td><strong>' + esc(r.full_name) + '</strong></td>' +
                  '  <td><button type="button" class="tepa-bo-code-btn" data-action="copy-text" data-text="' + esc(r.unique_code) + '" data-label="Participant Code" title="Click to copy code">' + icon('copy', 11) + ' ' + esc(r.unique_code) + '</button></td>' +
                  '  <td><span class="tepa-bo-badge ' + (r.passed_criteria ? 'is-green' : 'is-muted') + '">' + esc(r.score) + ' / ' + esc(r.total_questions) + '</span></td>' +
                  '  <td>' + (r.is_voucher_winner
                    ? '<span class="tepa-bo-badge is-gold">Voucher Winner</span>'
                    : (r.passed_criteria ? '<span class="tepa-bo-badge is-blue">Passed</span>' : '<span class="tepa-bo-badge is-muted">Participant</span>')) + '</td>' +
                  '  <td style="color:#64748B;">' + esc(formatTime(r.created_at)) + '</td>' +
                  '  <td>' + (r.is_voucher_winner
                    ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm ' + (r.voucher_claimed ? 'tepa-bo-btn-success' : 'tepa-bo-btn-dark') + '" data-action="toggle-claim" data-id="' + esc(r.id) + '" data-val="' + (!r.voucher_claimed) + '">' + (r.voucher_claimed ? (icon('check', 12) + '<span>Redeemed</span>') : 'Mark Redeemed') + '</button>'
                    : '<span style="color:#94A3B8;">—</span>') + '</td>' +
                  '</tr>'
                );
              }).join('')
            : '<tr><td colspan="7" style="text-align:center;padding:28px;color:#64748B;">No quiz submissions match this filter.</td></tr>') +
          '    </tbody></table></div>' +
          '</div>'
        );
      }

      if (state.tab === 'audit') {
        var actQuiz = k.activeQuiz;
        var actQuizQs = actQuiz
          ? allQs.filter(function (q) { return (!q.quiz_id || q.quiz_id === actQuiz.id) && q.is_active !== false; })
          : [];
        var minScoreOk = actQuiz && actQuizQs.length > 0 && Number(actQuiz.min_score || 1) <= actQuizQs.length;
        var activeProjs = k.activeProjects;

        var auditItems = [
          {
            ok: true,
            title: '1. WordPress-Only Access & Row-Level Security',
            desc: 'Backoffice protected exclusively by WordPress admin session (manage_options) + database Row-Level Security with hidden correct answers.',
            badge: 'PROTECTED',
            actionTab: 'settings',
            actionLbl: 'Security'
          },
          {
            ok: true,
            title: '2. Live Sync Engine (' + (mode === 'supabase' ? 'Production Cloud' : 'Demo Rehearsal Mode') + ')',
            desc: mode === 'supabase'
              ? 'Connected to live cloud database with instant WebSocket synchronization active across all event tables.'
              : 'Local rehearsal mode active via BroadcastChannel. Turn OFF Force Demo Mode in WordPress settings for live event day.',
            badge: mode === 'supabase' ? 'ONLINE' : 'DEMO MODE',
            actionTab: 'settings',
            actionLbl: 'Connection'
          },
          {
            ok: Boolean(actQuiz && actQuizQs.length > 0 && minScoreOk),
            title: '3. Active Quiz Integrity ("' + (actQuiz ? actQuiz.title : 'None') + '")',
            desc: actQuiz
              ? (actQuizQs.length + ' active questions · Min score: ' + (actQuiz.min_score || 1) + ' / ' + actQuizQs.length + ' · ' + (actQuiz.questions_per_page || 2) + ' per mobile screen.')
              : 'No active quiz selected.',
            badge: (actQuiz && actQuizQs.length > 0) ? 'READY' : 'CHECK',
            actionTab: 'questions',
            actionLbl: 'Quiz Studio'
          },
          {
            ok: Boolean(activeProjs.length >= 2),
            title: '4. Active Voting Poll ("' + (k.activePoll ? k.activePoll.title : 'Default') + '" · ' + activeProjs.length + ' active)',
            desc: activeProjs.length + ' of ' + k.pollProjects.length + (k.isSimpleActivePoll ? ' options' : ' finalist projects') + ' visible on 16:9 stage & mobile voting. Share percentages calculated across ' + k.totalVotes + ' active votes (100% sum).',
            badge: activeProjs.length + ' ACTIVE',
            actionTab: 'projects',
            actionLbl: 'Voting Studio'
          },
          {
            ok: Boolean(s.quiz_open && s.voting_open),
            title: '5. Mobile Participation Gates',
            desc: 'Mobile Quiz: ' + (s.quiz_open ? 'OPEN' : 'CLOSED') + ' · Final Voting: ' + (s.voting_open ? 'OPEN' : 'CLOSED') + '.',
            badge: (s.quiz_open && s.voting_open) ? 'OPEN' : 'PAUSED',
            actionTab: 'stage',
            actionLbl: 'Gates'
          },
          {
            ok: true,
            title: '6. Prize Vouchers & Live Screen Reveal (' + k.voucherWinners.length + ' / ' + k.maxVouchers + ')',
            desc: 'Players never see winner status on their phones after answering — only the platform manager can announce winners on the 16:9 Live Screen (' + (s.reveal_quiz_winners ? 'CURRENTLY ANNOUNCED ON 16:9' : 'HIDDEN UNTIL MANAGER ANNOUNCES') + ').',
            badge: s.reveal_quiz_winners ? 'ANNOUNCED 16:9' : 'SECRET / READY',
            actionTab: 'submissions',
            actionLbl: 'Winners Desk'
          },
          {
            ok: true,
            title: '7. 16:9 Auditorium Stage (Mode: ' + (s.stage_mode === 'quiz_qr' ? 'Quiz QR' : (s.stage_mode === 'winner_reveal' ? 'Winner Reveal' : 'Live Voting')) + ')',
            desc: 'Automatic adaptive density (xl / lg / md / sm) with zero whitespace gaps, Light/Dark mode, and collapsible QR sidebar.',
            badge: 'SYNCED',
            actionTab: 'stage',
            actionLbl: 'Stage 16:9'
          },
          {
            ok: true,
            title: '8. Non-Destructive Round Epochs',
            desc: 'Quiz Round #' + (s.quiz_epoch || 1) + ' · Voting Round #' + (s.vote_epoch || 1) + '. Resetting clears the stage cleanly while preserving historical records.',
            badge: 'ROUND #' + (s.vote_epoch || 1),
            actionTab: 'stage',
            actionLbl: 'Rounds'
          }
        ];

        return (
          '<div class="tepa-bo-card" style="margin-bottom:16px;">' +
          '  <div class="tepa-bo-card-head">' +
          '    <div>' +
          '      <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('shield', 15) + '</span><h2 class="tepa-bo-card-title">Functional Audit &amp; Event Readiness Report</h2></div>' +
          '      <p class="tepa-bo-card-desc">Real-time health check across all 8 critical subsystems of TEPA Performance Award 2026.</p>' +
          '    </div>' +
          '    <span class="tepa-bo-badge is-green" style="height:30px;padding:0 12px;">' + icon('check', 13) + ' All Systems Operational</span>' +
          '  </div>' +
          '  <div class="tepa-bo-audit-grid">' +
          auditItems.map(function (item) {
            return (
              '<div class="tepa-bo-audit-item ' + (item.ok ? 'is-ok' : 'is-warn') + '">' +
              '  <div style="flex:1;min-width:0;">' +
              '    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">' +
              '      <strong style="font-size:13.5px;color:#0F172A;">' + esc(item.title) + '</strong>' +
              '      <span class="tepa-bo-badge ' + (item.ok ? 'is-green' : 'is-gold') + '">' + esc(item.badge) + '</span>' +
              '    </div>' +
              '    <p style="font-size:12.5px;color:#475569;">' + esc(item.desc) + '</p>' +
              '  </div>' +
              '  <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-tab="' + item.actionTab + '"><span>' + esc(item.actionLbl) + '</span>' + icon('arrowRight', 12) + '</button>' +
              '</div>'
            );
          }).join('') +
          '  </div>' +
          '</div>'
        );
      }

      var quizAbs = absUrl(quizScreenUrl);
      var voteAbs = absUrl(voteScreenUrl);
      var liveAbs = absUrl(liveScreenUrl);

      return (
        '<div class="tepa-bo-grid-3">' +
        '  <div class="tepa-bo-card tepa-bo-qr-card">' +
        '    <h3 class="tepa-bo-card-title">1. Final Voting QR</h3>' +
        '    <div class="tepa-bo-qr-box" id="tepa-admin-qr-vote"></div>' +
        '    <div class="tepa-bo-qr-url">' + esc(voteAbs) + '</div>' +
        '    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="copy-text" data-text="' + esc(voteAbs) + '" data-label="Voting URL">' + icon('copy', 12) + '<span>Copy Link</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="download-qr" data-target="tepa-admin-qr-vote" data-filename="tepa-voting-qr.svg">' + icon('download', 12) + '<span>SVG</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-dark" data-action="download-qr-png" data-target="tepa-admin-qr-vote" data-filename="tepa-voting-qr.png">' + icon('download', 12) + '<span>PNG 1024px</span></button>' +
        '    </div>' +
        '  </div>' +
        '  <div class="tepa-bo-card tepa-bo-qr-card">' +
        '    <h3 class="tepa-bo-card-title">2. Welcome Quiz QR</h3>' +
        '    <div class="tepa-bo-qr-box" id="tepa-admin-qr-quiz"></div>' +
        '    <div class="tepa-bo-qr-url">' + esc(quizAbs) + '</div>' +
        '    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="copy-text" data-text="' + esc(quizAbs) + '" data-label="Quiz URL">' + icon('copy', 12) + '<span>Copy Link</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="download-qr" data-target="tepa-admin-qr-quiz" data-filename="tepa-quiz-qr.svg">' + icon('download', 12) + '<span>SVG</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-dark" data-action="download-qr-png" data-target="tepa-admin-qr-quiz" data-filename="tepa-quiz-qr.png">' + icon('download', 12) + '<span>PNG 1024px</span></button>' +
        '    </div>' +
        '  </div>' +
        '  <div class="tepa-bo-card tepa-bo-qr-card">' +
        '    <h3 class="tepa-bo-card-title">3. Auditorium 16:9 Screen</h3>' +
        '    <div class="tepa-bo-qr-box" id="tepa-admin-qr-live"></div>' +
        '    <div class="tepa-bo-qr-url">' + esc(liveAbs) + '</div>' +
        '    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="copy-text" data-text="' + esc(liveAbs) + '" data-label="Live URL">' + icon('copy', 12) + '<span>Copy Link</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="download-qr" data-target="tepa-admin-qr-live" data-filename="tepa-live-qr.svg">' + icon('download', 12) + '<span>SVG</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-dark" data-action="download-qr-png" data-target="tepa-admin-qr-live" data-filename="tepa-live-qr.png">' + icon('download', 12) + '<span>PNG 1024px</span></button>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="tepa-bo-grid-2">' +
        '  <div class="tepa-bo-card">' +
        '    <div class="tepa-bo-card-head">' +
        '      <div>' +
        '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('radio', 15) + '</span><h2 class="tepa-bo-card-title">Live Database Connection (WordPress)</h2></div>' +
        '        <p class="tepa-bo-card-desc">Credentials &amp; live/rehearsal mode saved in WordPress Settings.</p>' +
        '      </div>' +
        '      <span class="tepa-bo-badge ' + (mode === 'supabase' ? 'is-green' : 'is-gold') + '">' + (mode === 'supabase' ? 'Connected' : 'Demo Active') + '</span>' +
        '    </div>' +
        (hasWpTpl
          ? '<div id="tepa-wp-settings-mount"></div>'
          : '<div class="tepa-bo-field">' +
            '  <div class="tepa-bo-label">Project URL</div>' +
            '  <div class="tepa-bo-qr-url">' + esc(cfg.supabaseUrl || 'Not configured') + '</div>' +
            '</div>' +
            '<div class="tepa-bo-field">' +
            '  <div class="tepa-bo-label">Active Mode</div>' +
            '  <p>' + (mode === 'supabase' ? 'Live Cloud Database (configured via WordPress / config.js).' : 'Demo Mode (?demo=1 or forceDemo=true).') + '</p>' +
            '</div>') +
        '  </div>' +
        '  <div class="tepa-bo-card">' +
        '    <div class="tepa-bo-card-head">' +
        '      <div>' +
        '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('lock', 15) + '</span><h2 class="tepa-bo-card-title">Event Admin Security PIN</h2></div>' +
        '        <p class="tepa-bo-card-desc">Update the PIN required to unlock this Command Center.</p>' +
        '      </div>' +
        '      <span class="tepa-bo-badge is-muted">Min 4 chars</span>' +
        '    </div>' +
        '    <form id="tepa-change-pin-form">' +
        '      <div class="tepa-bo-field">' +
        '        <label class="tepa-bo-label" for="tepa-new-pin">New Admin PIN</label>' +
        '        <input id="tepa-new-pin" class="tepa-bo-input" type="password" minlength="4" placeholder="Enter new PIN (min 4 chars)" required>' +
        '      </div>' +
        '      <div class="tepa-bo-field">' +
        '        <label class="tepa-bo-label" for="tepa-confirm-pin">Confirm New PIN</label>' +
        '        <input id="tepa-confirm-pin" class="tepa-bo-input" type="password" minlength="4" placeholder="Repeat new PIN" required>' +
        '      </div>' +
        '      <div style="display:flex;justify-content:flex-end;">' +
        '        <button type="submit" class="tepa-bo-btn tepa-bo-btn-dark">' + icon('check', 14) + '<span>Update Admin PIN</span></button>' +
        '      </div>' +
        '    </form>' +
        '  </div>' +
        '</div>'
      );
    }

    function hydrateTabPanelAfterPaint() {
      var panel = root.querySelector('#tepa-bo-tab-panel');
      if (!panel) return;
      var cfg = Store.getConfig();
      var hasWpTpl = Boolean(document.getElementById('tepa-wp-settings-tpl'));
      if (state.tab === 'settings') {
        renderQR(panel.querySelector('#tepa-admin-qr-vote'), absUrl(cfg.homeUrl || cfg.voteUrl || 'vote.html'));
        renderQR(panel.querySelector('#tepa-admin-qr-quiz'), absUrl(cfg.quizUrl || 'quiz.html'));
        renderQR(panel.querySelector('#tepa-admin-qr-live'), absUrl(cfg.liveUrl || 'live.html'));
        if (hasWpTpl) mountWpSettingsTemplate('tepa-wp-settings-mount');
      } else if (state.tab === 'stage') {
        springAnimateBars(panel, '.tepa-bo-leader-fill', 'width', 35);
      } else if (state.tab === 'projects') {
        springAnimateBars(panel, '.tepa-bo-proj-bar-fill', 'width', 14);
      }
    }

    function render(animateTab) {
      var mode = Store.getMode();
      var cfg = Store.getConfig();
      var hasWpTpl = Boolean(document.getElementById('tepa-wp-settings-tpl'));

      // 0. Strict WordPress-Only Access Gate
      if (cfg.requireWpAdmin && !cfg.isWpAdmin) {
        root.innerHTML =
          '<div class="tepa-bo tepa-anim-enter" style="padding:48px 20px;">' +
          '  <div class="tepa-bo-unlock-wrap">' +
          '    <div class="tepa-bo-card has-rainbow">' +
          '      <div class="tepa-bo-rainbow-bar"></div>' +
          '      <div style="padding-top:20px;">' +
          renderBrandBlock('<span class="tepa-bo-badge is-red">' + icon('lock', 12) + ' WordPress Admin Only</span>') +
          '        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #E2E8F0;">' +
          '          <h2 class="tepa-bo-card-title" style="margin-bottom:6px;">Backoffice Protected by WordPress</h2>' +
          '          <p class="tepa-bo-card-desc" style="margin-bottom:18px;">The TEPA Performance Award 2026 Command Center can only be accessed via the WordPress administration panel (<code>wp-admin</code>) with an active administrator session.</p>' +
          '          <a href="' + esc(cfg.adminUrl || '/wp-admin/admin.php?page=tepa-award-2026') + '" class="tepa-bo-btn tepa-bo-btn-primary" style="width:100%;height:42px;">Sign in via WordPress (WP-Admin) →</a>' +
          '        </div>' +
          '      </div>' +
          '    </div>' +
          '  </div>' +
          '</div>';
        return;
      }

      // 1. PIN Unlock Gate
      if (mode === 'supabase' && !state.pin && !state.data) {
        state.hasAnimatedKpis = false;
        root.innerHTML =
          '<div class="tepa-bo tepa-anim-enter" style="padding:48px 20px;">' +
          '  <div class="tepa-bo-unlock-wrap">' +
          '    <div class="tepa-bo-card has-rainbow">' +
          '      <div class="tepa-bo-rainbow-bar"></div>' +
          '      <div style="padding-top:20px;">' +
          renderBrandBlock('<span class="tepa-bo-status-pill is-live"><span class="tepa-bo-status-dot"></span> Live Event · WP-Admin</span>') +
          '        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #E2E8F0;">' +
          '          <h2 class="tepa-bo-card-title" style="margin-bottom:4px;">Unlock Event Controls</h2>' +
          '          <p class="tepa-bo-card-desc" style="margin-bottom:14px;">Enter the Event Admin PIN (default: <code>2026</code>) to manage quizzes, votes, projects, and the 16:9 stage.</p>' +
          '          <form id="tepa-pin-form">' +
          '            <div class="tepa-bo-field">' +
          '              <label class="tepa-bo-label" for="tepa-pin-input">Admin PIN</label>' +
          '              <input id="tepa-pin-input" type="password" class="tepa-bo-input" placeholder="Enter Event PIN" autocomplete="current-password" required>' +
          '            </div>' +
          (state.error ? '<div class="tepa-bo-alert is-error" style="margin-bottom:12px;">' + esc(state.error) + '</div>' : '') +
          '            <button type="submit" class="tepa-bo-btn tepa-bo-btn-primary" style="width:100%;height:42px;">' + icon('lock', 14) + '<span>Unlock Command Center</span></button>' +
          '          </form>' +
          '        </div>' +
          '      </div>' +
          '    </div>' +
          (hasWpTpl
            ? '<details class="tepa-bo-card tepa-bo-details">' +
              '  <summary><span>WordPress Database Connection &amp; Demo Mode</span><span class="tepa-bo-badge is-muted">WP Settings</span></summary>' +
              '  <div id="tepa-wp-unlock-settings-mount" style="margin-top:16px;padding-top:14px;border-top:1px solid #E2E8F0;"></div>' +
              '</details>'
            : '') +
          '  </div>' +
          '</div>';
        if (hasWpTpl) mountWpSettingsTemplate('tepa-wp-unlock-settings-mount');
        return;
      }

      // 2. Loading State
      if (state.loading || !state.data) {
        state.hasAnimatedKpis = false;
        root.innerHTML =
          '<div class="tepa-bo" style="padding:48px 20px;">' +
          '  <div class="tepa-bo-card has-rainbow">' +
          '    <div class="tepa-bo-rainbow-bar"></div>' +
          '    <div style="padding:28px 0;text-align:center;">' +
          '      <p style="font-weight:600;color:#0F172A;">Loading TEPA 2026 Event Backoffice...</p>' +
          (state.error ? '<p style="color:#B91C1C;margin-top:8px;">' + esc(state.error) + '</p>' : '') +
          '    </div>' +
          '  </div>' +
          '</div>';
        return;
      }

      var existingPanel = root.querySelector('#tepa-bo-tab-panel');
      var existingShell = root.querySelector('#tepa-bo-shell');
      if (existingShell && existingPanel) {
        syncTabsInPlace(state.data);
        patchKpisInPlace(state.data, false);
        if (animateTab) {
          existingPanel.classList.remove('tepa-anim-tab');
          void existingPanel.offsetWidth;
          existingPanel.classList.add('tepa-anim-tab');
        }
        existingPanel.innerHTML = buildTabPanelHtml();
        hydrateTabPanelAfterPaint();
        syncAdminModal();
        syncFloatingSaveBar();
        return;
      }

      var k = computeKpis(state.data);
      var s = k.s;
      var subs = k.subs;
      var projects = k.projects;
      var selQuiz = ensureSelectedQuiz(state.data);
      var allQs = state.data.questions || [];
      var quizQs = selQuiz ? allQs.filter(function (q) { return !q.quiz_id || q.quiz_id === selQuiz.id; }) : allQs;
      var selPoll = ensureSelectedPoll(state.data);
      var selProjs = selPoll ? projects.filter(function (p) { return !p.poll_id || p.poll_id === selPoll.id; }) : projects;
      var activeSelProjCount = selProjs.filter(function (p) { return getProjectDraft(p).is_active !== false; }).length;
      var voteScreenUrl = cfg.homeUrl || cfg.voteUrl || 'vote.html';
      var quizScreenUrl = cfg.quizUrl || 'quiz.html';
      var liveScreenUrl = cfg.liveUrl || 'live.html';
      var meta = SECTION_META[state.tab] || SECTION_META.stage;
      var stageBadgeText = s.stage_mode === 'quiz_qr' ? 'Quiz QR' : (s.stage_mode === 'winner_reveal' ? 'Winner' : 'Voting');

      root.innerHTML =
        '<div class="tepa-bo tepa-bo-app tepa-anim-enter" id="tepa-bo-shell">' +
        '  <aside class="tepa-bo-sidebar" aria-label="TEPA Navigation">' +
        '    <div class="tepa-bo-rainbow-bar"></div>' +
        '    <div class="tepa-bo-side-brand">' +
        '      <div class="tepa-bo-side-logos">' +
        '        <span class="tepa-bo-side-te-pill"><img src="' + esc(assetUrl('totalenergies-logo.png')) + '" alt="TotalEnergies"></span>' +
        '        <img class="tepa-bo-side-lu-logo" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">' +
        '      </div>' +
        '      <div>' +
        '        <div class="tepa-bo-side-title">TEPA Award 2026</div>' +
        '        <div class="tepa-bo-side-sub">WordPress Event Studio</div>' +
        '      </div>' +
        (mode === 'demo'
          ? '<span class="tepa-bo-side-rt is-demo"><span class="tepa-bo-status-dot"></span> Demo / Rehearsal Mode</span>'
          : '') +
        '    </div>' +
        '    <nav class="tepa-bo-side-nav" aria-label="Backoffice Sections">' +
        '      <div class="tepa-bo-side-group-lbl">Event Control</div>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'stage' ? 'is-active' : '') + '" data-tab="stage">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('radio', 15) + '</span><span>Live Stage &amp; Controls</span></span>' +
        '        <span class="tepa-bo-nav-badge is-live" data-tab-count="stage">' + esc(stageBadgeText) + '</span>' +
        '      </button>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'livescreen' ? 'is-active' : '') + '" data-tab="livescreen">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('monitor', 15) + '</span><span>16:9 Live Screen</span></span>' +
        '        <span class="tepa-bo-nav-badge" data-tab-count="livescreen">' + esc((s.live_theme === 'dark' ? 'Dark' : 'Light') + ' · ' + (s.stage_mode === 'quiz_qr' ? 'S1' : (s.stage_mode === 'winner_reveal' ? 'S3' : 'S2'))) + '</span>' +
        '      </button>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'questions' ? 'is-active' : '') + '" data-tab="questions">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('sparkles', 15) + '</span><span>Quiz Studio</span></span>' +
        '        <span class="tepa-bo-nav-badge" data-tab-count="questions">' + quizQs.length + '</span>' +
        '      </button>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'projects' ? 'is-active' : '') + '" data-tab="projects">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('trophy', 15) + '</span><span>Voting &amp; Projects</span></span>' +
        '        <span class="tepa-bo-nav-badge" data-tab-count="projects">' + (activeSelProjCount === selProjs.length ? selProjs.length : (activeSelProjCount + '/' + selProjs.length)) + '</span>' +
        '      </button>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'submissions' ? 'is-active' : '') + '" data-tab="submissions">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('gift', 15) + '</span><span>Winners &amp; Desk</span></span>' +
        '        <span class="tepa-bo-nav-badge" data-tab-count="submissions">' + subs.length + '</span>' +
        '      </button>' +
        '      <div class="tepa-bo-side-group-lbl">System &amp; Security</div>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'settings' ? 'is-active' : '') + '" data-tab="settings">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('qr', 15) + '</span><span>QR Kit &amp; Connection</span></span>' +
        '      </button>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'audit' ? 'is-active' : '') + '" data-tab="audit">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('shield', 15) + '</span><span>System Audit</span></span>' +
        '        <span class="tepa-bo-nav-badge is-live">OK</span>' +
        '      </button>' +
        '    </nav>' +
        '    <div class="tepa-bo-side-footer">' +
        '      <a href="' + esc(liveScreenUrl) + '" target="_blank" class="tepa-bo-side-link is-primary">' + icon('monitor', 14) + '<span>Open 16:9 Live Screen</span>' + icon('external', 12) + '</a>' +
        '      <div class="tepa-bo-side-launch-grid">' +
        '        <a href="' + esc(quizScreenUrl) + '" target="_blank" class="tepa-bo-side-link">' + icon('help', 13) + '<span>Quiz</span>' + icon('external', 11) + '</a>' +
        '        <a href="' + esc(voteScreenUrl) + '" target="_blank" class="tepa-bo-side-link">' + icon('vote', 13) + '<span>Voting</span>' + icon('external', 11) + '</a>' +
        '      </div>' +
        '      <div class="tepa-bo-wp-meta">' +
        '        <div class="tepa-bo-wp-meta-row">' +
        '          <span style="display:inline-flex;align-items:center;gap:5px;">' + icon('lock', 11) + ' WordPress Admin</span>' +
        '          <strong style="color:#E2E8F0;">' + esc(cfg.wpUserDisplay || 'Admin') + '</strong>' +
        '        </div>' +
        '        <div class="tepa-bo-side-launch-grid">' +
        (cfg.wpDashboardUrl
          ? '<a href="' + esc(cfg.wpDashboardUrl) + '" class="tepa-bo-side-link" title="Return to standard WordPress Dashboard">' + icon('arrowLeft', 12) + '<span>WP-Admin</span></a>' +
            '<button type="button" class="tepa-bo-side-link" data-action="toggle-wp-chrome" title="Show/Hide native WordPress sidebar">' + icon('layout', 12) + '<span>WP Menu</span></button>'
          : '<button type="button" class="tepa-bo-side-link" data-action="toggle-wp-chrome" title="Toggle Fullscreen Focus">' + icon('maximize', 12) + '<span>Fullscreen</span></button>' +
            (mode === 'supabase'
              ? '<button type="button" class="tepa-bo-side-link" data-action="lock-admin" title="Lock Admin Console">' + icon('lock', 12) + '<span>Lock</span></button>'
              : '<button type="button" class="tepa-bo-side-link" data-tab="audit">' + icon('shield', 12) + '<span>Audit</span></button>')) +
        '        </div>' +
        '      </div>' +
        '    </div>' +
        '  </aside>' +
        '  <div class="tepa-bo-main">' +
        '    <header class="tepa-bo-topbar">' +
        '      <div class="tepa-bo-topbar-left">' +
        '        <span class="tepa-bo-topbar-icon" id="tepa-bo-topbar-icon">' + icon(meta.iconName, 18) + '</span>' +
        '        <div style="min-width:0;">' +
        '          <div class="tepa-bo-topbar-title" id="tepa-bo-topbar-title">' + esc(meta.title) + '</div>' +
        '          <div class="tepa-bo-topbar-desc" id="tepa-bo-topbar-desc">' + esc(meta.desc) + '</div>' +
        '        </div>' +
        '      </div>' +
        '      <div class="tepa-bo-topbar-controls">' +
        '        <span id="tepa-bo-toast-slot">' + (state.notice ? '<span class="tepa-bo-toast ' + (state.noticeType === 'err' ? 'is-err' : '') + '">' + esc(state.notice) + '</span>' : '') + '</span>' +
        '        <div class="tepa-bo-quick-stage" title="Quickly switch the 16:9 Auditorium Stage from any menu">' +
        '          <span class="tepa-bo-quick-stage-lbl">' + icon('monitor', 12) + '<span>16:9 Stage:</span></span>' +
        '          <button type="button" class="tepa-bo-quick-stage-btn ' + (s.stage_mode === 'quiz_qr' ? 'is-active' : '') + '" data-quick-stage data-action="set-stage" data-val="quiz_qr">1. Quiz QR</button>' +
        '          <button type="button" class="tepa-bo-quick-stage-btn ' + (s.stage_mode === 'live_voting' ? 'is-active' : '') + '" data-quick-stage data-action="set-stage" data-val="live_voting">2. Live Voting</button>' +
        '          <button type="button" class="tepa-bo-quick-stage-btn ' + (s.stage_mode === 'winner_reveal' ? 'is-active' : '') + '" data-quick-stage data-action="set-stage" data-val="winner_reveal">3. Winner</button>' +
        '        </div>' +
        (mode === 'supabase' && cfg.wpDashboardUrl
          ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="lock-admin" title="Lock Admin Console">' + icon('lock', 13) + '<span>Lock</span></button>'
          : '') +
        '      </div>' +
        '    </header>' +
        '    <div class="tepa-bo-content">' +
        (mode === 'demo'
          ? '<div class="tepa-bo-alert is-warn">' +
            '  <div><strong>Demo / Rehearsal Mode Active:</strong> Votes, quizzes, and edits stay in browser local storage / BroadcastChannel without writing to the live cloud database.' +
            (hasWpTpl ? ' Turn OFF <em>Force Demo Mode</em> in Connection Settings when ready to go live.' : '') +
            '  </div>' +
            '  <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-tab="settings"><span>Connection Settings</span>' + icon('arrowRight', 12) + '</button>' +
            '</div>'
          : '') +
        (state.error ? '<div class="tepa-bo-alert is-error"><div><strong>Action notice:</strong> ' + esc(state.error) + '</div></div>' : '') +
        '      <section class="tepa-bo-kpis">' +
        '        <div class="tepa-bo-kpi-card" data-tab="projects" title="Click to manage polls &amp; projects">' +
        '          <div class="tepa-bo-kpi-head">' +
        '            <span class="tepa-bo-kpi-icon is-orange">' + icon('barChart', 18) + '</span>' +
        '            <span data-kpi-votes-badge class="tepa-bo-badge ' + (s.voting_open ? 'is-green' : 'is-red') + '">' + (s.voting_open ? 'Voting Open' : 'Voting Closed') + '</span>' +
        '          </div>' +
        '          <div class="tepa-bo-kpi-label">Total Votes Cast</div>' +
        '          <div class="tepa-bo-kpi-value" data-kpi-votes>' + esc(k.totalVotes) + '</div>' +
        '          <div class="tepa-bo-kpi-sub" data-kpi-votes-sub>Round #' + esc(s.vote_epoch || 1) + ' · ' + esc(k.activeProjects.length) + (k.isSimpleActivePoll ? ' active options' : ' active finalists') + '</div>' +
        '        </div>' +
        '        <div class="tepa-bo-kpi-card" data-tab="stage" title="Click to view Live Top 5 Standings">' +
        '          <div class="tepa-bo-kpi-head">' +
        '            <span class="tepa-bo-kpi-icon is-blue">' + icon('trophy', 18) + '</span>' +
        '            <span class="tepa-bo-badge is-blue">' + (k.isSimpleActivePoll ? 'Top Choice' : 'Best of the Best') + '</span>' +
        '          </div>' +
        '          <div class="tepa-bo-kpi-label">Current Leader</div>' +
        '          <div class="tepa-bo-kpi-value is-text" data-kpi-leader title="' + esc(k.leader ? k.leader.project_title : '') + '">' + esc(k.leader ? k.leader.project_title : 'No votes yet') + '</div>' +
        '          <div class="tepa-bo-kpi-sub" data-kpi-leader-sub>' + (k.leader ? esc((k.leader.votes || 0) + ' votes (' + k.leaderPct + '%)' + (k.leader.category_name ? (' · ' + k.leader.category_name) : '')) : 'Waiting for first vote') + '</div>' +
        '        </div>' +
        '        <div class="tepa-bo-kpi-card" data-tab="questions" title="Click to open Quiz Studio">' +
        '          <div class="tepa-bo-kpi-head">' +
        '            <span class="tepa-bo-kpi-icon is-purple">' + icon('users', 18) + '</span>' +
        '            <span data-kpi-quiz-badge class="tepa-bo-badge ' + (s.quiz_open ? 'is-green' : 'is-red') + '">' + (s.quiz_open ? 'Quiz Open' : 'Quiz Closed') + '</span>' +
        '          </div>' +
        '          <div class="tepa-bo-kpi-label">Quiz Participants</div>' +
        '          <div class="tepa-bo-kpi-value" data-kpi-quiz>' + esc(subs.length) + '</div>' +
        '          <div class="tepa-bo-kpi-sub" data-kpi-quiz-sub>' + esc(k.passedCount) + ' passed min score · Round #' + esc(s.quiz_epoch || 1) + '</div>' +
        '        </div>' +
        '        <div class="tepa-bo-kpi-card" data-tab="submissions" title="Click to manage Winners & Prize Desk">' +
        '          <div class="tepa-bo-kpi-head">' +
        '            <span class="tepa-bo-kpi-icon is-amber">' + icon('ticket', 18) + '</span>' +
        '            <span data-kpi-vouchers-badge class="tepa-bo-badge is-gold">First ' + esc(k.maxVouchers) + '</span>' +
        '          </div>' +
        '          <div class="tepa-bo-kpi-label">Prize Vouchers</div>' +
        '          <div class="tepa-bo-kpi-value" data-kpi-vouchers>' + esc(k.voucherWinners.length) + ' / ' + esc(k.maxVouchers) + '</div>' +
        '          <div class="tepa-bo-kpi-sub" data-kpi-vouchers-sub>' + esc(k.redeemedCount) + ' redeemed at prize desk</div>' +
        '          <div class="tepa-bo-progress"><div class="tepa-bo-progress-fill" data-kpi-vouchers-bar style="width:' + k.voucherPct + '%;"></div></div>' +
        '        </div>' +
        '      </section>' +
        '      <div id="tepa-bo-tab-panel" class="tepa-anim-tab">' + buildTabPanelHtml() + '</div>' +
        '    </div>' +
        '  </div>' +
        '  <div id="tepa-bo-floating-slot"></div>' +
        '  <div id="tepa-bo-modal-slot"></div>' +
        '</div>';

      if (!state.hasAnimatedKpis) {
        patchKpisInPlace(state.data, true);
        state.hasAnimatedKpis = true;
      }
      hydrateTabPanelAfterPaint();
      syncAdminModal();
      syncFloatingSaveBar();
    }

    function readQuestionRowToDirty(qRow) {
      if (!qRow || !state.data) return null;
      var qid = Number(qRow.getAttribute('data-q-row'));
      var origQ = (state.data.questions || []).find(function (q) { return q.id === qid; });
      if (!origQ) return null;
      var cur = getQuestionDraft(origQ);
      var optInputs = Array.from(qRow.querySelectorAll('input[data-opt-idx]'));
      var nextOpts = optInputs.length
        ? optInputs.map(function (inp) { return inp.value; })
        : (cur.options || []);
      var draft = {
        id: qid,
        question_text: qRow.querySelector('[data-field="question_text"]').value,
        question_type: cur.question_type || 'yes_no',
        options: nextOpts,
        correct_answer: Boolean(cur.correct_answer),
        correct_option: Number(cur.correct_option || 0),
        is_active: qRow.querySelector('[data-field="is_active"]').checked
      };
      state.dirtyQuestions[qid] = draft;
      return draft;
    }

    function readProjectRowToDirty(projRow) {
      if (!projRow || !state.data) return null;
      var pid = Number(projRow.getAttribute('data-proj-row'));
      var origP = (state.data.projects || []).find(function (p) { return p.id === pid; });
      if (!origP) return null;
      var curP = getProjectDraft(origP);
      var catInp = projRow.querySelector('[data-field="category_name"]');
      var titleInp = projRow.querySelector('[data-field="project_title"]');
      var teamInp = projRow.querySelector('[data-field="team_name"]');
      var actInp = projRow.querySelector('[data-field="is_active"]');
      var draft = {
        id: pid,
        category_name: catInp ? catInp.value : (curP.category_name || ''),
        project_title: titleInp ? titleInp.value : (curP.project_title || ''),
        team_name: teamInp ? teamInp.value : (curP.team_name || ''),
        is_active: actInp ? actInp.checked : (curP.is_active !== false)
      };
      state.dirtyProjects[pid] = draft;
      return draft;
    }

    root.addEventListener('submit', async function (ev) {
      if (!ev.target) return;

      if (ev.target.id === 'tepa-pin-form') {
        ev.preventDefault();
        var val = (root.querySelector('#tepa-pin-input') || {}).value || '';
        state.pin = val;
        state.manuallyLocked = false;
        try { sessionStorage.setItem(PIN_SESSION_KEY, val); } catch (e) {}
        state.loading = true;
        render(false);
        loadAdmin(false);
        return;
      }

      if (ev.target.id === 'tepa-rules-form') {
        ev.preventDefault();
        var titleVal = ((root.querySelector('#tepa-rule-title') || {}).value || '').trim();
        var minScoreVal = Number((root.querySelector('#tepa-rule-minscore') || {}).value || 5);
        var maxVVal = Number((root.querySelector('#tepa-rule-maxv') || {}).value || 10);
        var rRes = await Store.adminAction(state.pin || '2026', 'update_settings', {
          event_title: titleVal,
          min_quiz_score: Math.max(1, minScoreVal),
          max_vouchers: Math.max(1, maxVVal)
        });
        if (rRes && rRes.ok) {
          await loadAdmin(false);
          flash('Event rules saved!');
        } else {
          flash((rRes && rRes.error) || 'Failed to save rules.', true);
        }
        return;
      }

      if (ev.target.id === 'tepa-quiz-meta-form') {
        ev.preventDefault();
        var qzId = ev.target.getAttribute('data-quiz-id');
        var qzTitle = ((ev.target.querySelector('[data-qmeta="title"]') || {}).value || '').trim();
        var qzSub = ((ev.target.querySelector('[data-qmeta="subtitle"]') || {}).value || '').trim();
        var qzQpp = Number((ev.target.querySelector('[data-qmeta="questions_per_page"]') || {}).value || 2);
        var qzMin = Number((ev.target.querySelector('[data-qmeta="min_score"]') || {}).value || 5);
        var qzMax = Number((ev.target.querySelector('[data-qmeta="max_vouchers"]') || {}).value || 10);
        var qzVTitle = ((ev.target.querySelector('[data-qmeta="voucher_title"]') || {}).value || '').trim();
        var qzVOn = Boolean((ev.target.querySelector('[data-qmeta="voucher_enabled"]') || {}).checked);
        var qzRes = await Store.adminAction(state.pin || '2026', 'save_quiz', {
          id: qzId,
          title: qzTitle,
          subtitle: qzSub,
          questions_per_page: qzQpp,
          min_score: Math.max(1, qzMin),
          voucher_enabled: qzVOn,
          voucher_title: qzVTitle,
          max_vouchers: Math.max(1, qzMax)
        });
        if (qzRes && qzRes.ok) {
          delete state.quizDrafts[qzId];
          await loadAdmin(false);
          flash('Quiz settings saved!');
        } else {
          flash((qzRes && qzRes.error) || 'Failed to save quiz settings.', true);
        }
        return;
      }

      if (ev.target.id === 'tepa-poll-meta-form') {
        ev.preventDefault();
        var plId = ev.target.getAttribute('data-poll-id');
        var plTitle = ((ev.target.querySelector('[data-pmeta="title"]') || {}).value || '').trim();
        var plType = ((ev.target.querySelector('[data-pmeta="poll_type"]') || {}).value || 'projects');
        var plHead = ((ev.target.querySelector('[data-pmeta="voting_headline"]') || {}).value || '').trim();
        var plSub = ((ev.target.querySelector('[data-pmeta="voting_subtitle"]') || {}).value || '').trim();
        var plRes = await Store.adminAction(state.pin || '2026', 'save_poll', {
          id: plId,
          title: plTitle,
          poll_type: plType === 'simple' ? 'simple' : 'projects',
          voting_headline: plHead,
          voting_subtitle: plSub
        });
        if (plRes && plRes.ok) {
          delete state.pollDrafts[plId];
          await loadAdmin(false);
          flash('Voting poll settings saved!');
        } else {
          flash((plRes && plRes.error) || 'Failed to save poll settings.', true);
        }
        return;
      }

      if (ev.target.id === 'tepa-live-headlines-form') {
        ev.preventDefault();
        var lsEvTitle = ((root.querySelector('#tepa-ls-ev-title') || {}).value || '').trim();
        var lsVHead = ((root.querySelector('#tepa-ls-v-head') || {}).value || '').trim();
        var lsRes = await Store.adminAction(state.pin || '2026', 'update_settings', {
          event_title: lsEvTitle,
          voting_headline: lsVHead
        });
        if (lsRes && lsRes.ok) {
          state.pollCopyDraft = null;
          await loadAdmin(false);
          flash('16:9 Live Screen titles updated!');
        } else {
          flash((lsRes && lsRes.error) || 'Failed to update titles.', true);
        }
        return;
      }

      if (ev.target.id === 'tepa-change-pin-form') {
        ev.preventDefault();
        var p1 = ((root.querySelector('#tepa-new-pin') || {}).value || '').trim();
        var p2 = ((root.querySelector('#tepa-confirm-pin') || {}).value || '').trim();
        if (p1.length < 4) {
          flash('PIN must be at least 4 characters.', true);
          return;
        }
        if (p1 !== p2) {
          flash('PIN confirmation does not match.', true);
          return;
        }
        var pRes = await Store.adminAction(state.pin || '2026', 'change_pin', { new_pin: p1 });
        if (pRes && pRes.ok) {
          state.pin = p1;
          try { sessionStorage.setItem(PIN_SESSION_KEY, p1); } catch (e) {}
          ev.target.reset();
          flash('Admin PIN updated!');
        } else {
          flash((pRes && pRes.error) || 'Failed to update PIN.', true);
        }
      }
    });

    root.addEventListener('input', function (ev) {
      if (!ev.target) return;

      if (ev.target.id === 'tepa-admin-search') {
        state.search = ev.target.value;
        var pos = ev.target.selectionStart;
        render(false);
        var inp = root.querySelector('#tepa-admin-search');
        if (inp) {
          inp.focus();
          try { inp.setSelectionRange(pos, pos); } catch (e) {}
        }
        return;
      }

      if (ev.target.id === 'tepa-proj-search') {
        state.projSearch = ev.target.value;
        var pPos = ev.target.selectionStart;
        render(false);
        var pInp = root.querySelector('#tepa-proj-search');
        if (pInp) {
          pInp.focus();
          try { pInp.setSelectionRange(pPos, pPos); } catch (e) {}
        }
        return;
      }

      var pollMetaForm = ev.target.closest('#tepa-poll-meta-form');
      if (pollMetaForm && ev.target.hasAttribute('data-pmeta')) {
        var plMetaId = pollMetaForm.getAttribute('data-poll-id');
        if (!state.pollDrafts[plMetaId]) state.pollDrafts[plMetaId] = {};
        var pKey = ev.target.getAttribute('data-pmeta');
        state.pollDrafts[plMetaId][pKey] = ev.target.value;
        return;
      }

      var metaForm = ev.target.closest('#tepa-quiz-meta-form');
      if (metaForm && ev.target.hasAttribute('data-qmeta')) {
        var qzId = metaForm.getAttribute('data-quiz-id');
        if (!state.quizDrafts[qzId]) state.quizDrafts[qzId] = {};
        var mKey = ev.target.getAttribute('data-qmeta');
        state.quizDrafts[qzId][mKey] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
        updatePhonePreviewInPlace();
        return;
      }

      var projRow = ev.target.closest('[data-proj-row]');
      if (projRow && state.data) {
        var draftedP = readProjectRowToDirty(projRow);
        if (draftedP) {
          projRow.classList.add('is-dirty');
          projRow.classList.toggle('is-inactive', !draftedP.is_active);
          var rowBtn = projRow.querySelector('[data-action="save-project"]');
          if (rowBtn) rowBtn.classList.add('tepa-bo-btn-dark');
          updateDirtyCountersInPlace();
        }
        return;
      }

      var qRow = ev.target.closest('[data-q-row]');
      if (qRow && state.data) {
        readQuestionRowToDirty(qRow);
        qRow.classList.add('is-dirty');
        var qBtn = qRow.querySelector('[data-action="save-question"]');
        if (qBtn) qBtn.classList.add('tepa-bo-btn-dark');
        updateDirtyCountersInPlace();
        updatePhonePreviewInPlace();
      }
    });

    root.addEventListener('change', async function (ev) {
      if (!ev.target) return;
      var pin = state.pin || '2026';

      var pollMetaForm = ev.target.closest('#tepa-poll-meta-form');
      if (pollMetaForm && ev.target.hasAttribute('data-pmeta')) {
        var plMetaId = pollMetaForm.getAttribute('data-poll-id');
        if (!state.pollDrafts[plMetaId]) state.pollDrafts[plMetaId] = {};
        var pKey = ev.target.getAttribute('data-pmeta');
        state.pollDrafts[plMetaId][pKey] = ev.target.value;
        if (pKey === 'poll_type') render(false);
        return;
      }

      var metaForm = ev.target.closest('#tepa-quiz-meta-form');
      if (metaForm && ev.target.hasAttribute('data-qmeta')) {
        var qzId = metaForm.getAttribute('data-quiz-id');
        if (!state.quizDrafts[qzId]) state.quizDrafts[qzId] = {};
        var mKey = ev.target.getAttribute('data-qmeta');
        state.quizDrafts[qzId][mKey] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
        updatePhonePreviewInPlace();
        return;
      }

      var projRow = ev.target.closest('[data-proj-row]');
      if (projRow && ev.target.getAttribute('data-field') === 'is_active') {
        var draftedCh = readProjectRowToDirty(projRow);
        if (draftedCh) {
          projRow.classList.add('is-dirty');
          projRow.classList.toggle('is-inactive', !draftedCh.is_active);
          var rowBtnCh = projRow.querySelector('[data-action="save-project"]');
          if (rowBtnCh) rowBtnCh.classList.add('tepa-bo-btn-dark');
          updateDirtyCountersInPlace();
        }
        return;
      }

      var qRow = ev.target.closest('[data-q-row]');
      if (qRow && ev.target.getAttribute('data-field') === 'is_active') {
        readQuestionRowToDirty(qRow);
        qRow.classList.add('is-dirty');
        updateDirtyCountersInPlace();
        updatePhonePreviewInPlace();
      }
    });

    root.addEventListener('click', async function (ev) {
      if (!ev.target || !ev.target.closest) return;

      var tabBtn = ev.target.closest('[data-tab]');
      if (tabBtn) {
        var nextTab = tabBtn.getAttribute('data-tab');
        var changed = state.tab !== nextTab;
        state.tab = nextTab;
        render(changed);
        return;
      }

      var prevModeBtn = ev.target.closest('[data-preview-mode]');
      if (prevModeBtn) {
        state.previewScreen = prevModeBtn.getAttribute('data-preview-mode');
        updatePhonePreviewInPlace();
        return;
      }

      var prevQBtn = ev.target.closest('[data-preview-qidx]');
      if (prevQBtn) {
        state.previewQIdx = Number(prevQBtn.getAttribute('data-preview-qidx') || 0);
        updatePhonePreviewInPlace();
        return;
      }

      var filterBtn = ev.target.closest('[data-subfilter]');
      if (filterBtn) {
        state.subFilter = filterBtn.getAttribute('data-subfilter');
        render(false);
        return;
      }

      var projFilterBtn = ev.target.closest('[data-projfilter]');
      if (projFilterBtn) {
        state.projFilter = projFilterBtn.getAttribute('data-projfilter');
        render(false);
        return;
      }

      var btn = ev.target.closest('[data-action]');
      if (!btn) return;
      var act = btn.getAttribute('data-action');
      var pin = state.pin || '2026';

      if (act === 'toggle-wp-chrome') {
        document.body.classList.toggle('tepa-wp-immersive');
        if (!document.body.classList.contains('tepa-wp-admin-page')) {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(function () {});
          } else {
            document.exitFullscreen && document.exitFullscreen().catch(function () {});
          }
        }
        return;
      }

      if (act === 'lock-admin') {
        state.pin = '';
        state.manuallyLocked = true;
        state.data = null;
        state.error = '';
        try { sessionStorage.removeItem(PIN_SESSION_KEY); } catch (e) {}
        render(false);
        return;
      }

      if (act === 'set-stage') {
        var stageVal = btn.getAttribute('data-val');
        await Store.adminAction(pin, 'update_settings', {
          stage_mode: stageVal,
          reveal_winner: stageVal === 'winner_reveal'
        });
        await loadAdmin(false);
        flash('Stage switched to ' + stageVal.replace('_', ' '));
        return;
      }

      if (act === 'set-live-pref') {
        var prefKey = btn.getAttribute('data-key');
        var rawPrefVal = btn.getAttribute('data-val');
        var prefVal = (rawPrefVal === 'true' || rawPrefVal === 'false') ? (rawPrefVal === 'true') : rawPrefVal;
        var prefPayload = {};
        prefPayload[prefKey] = prefVal;
        if (prefKey === 'live_vertical_scope') {
          prefPayload.live_chart_type = 'vertical';
        }
        var prefRes = await Store.adminAction(pin, 'update_settings', prefPayload);
        if (prefRes && prefRes.ok) {
          await loadAdmin(false);
          flash('16:9 Live Screen updated in real time!');
        } else {
          flash((prefRes && prefRes.error) || 'Failed to update 16:9 display setting.', true);
        }
        return;
      }

      if (act === 'toggle-setting' && btn.tagName === 'INPUT') {
        var tKey = btn.getAttribute('data-key');
        var tPayload = {};
        tPayload[tKey] = Boolean(btn.checked);
        if (tKey === 'reveal_quiz_winners' && tPayload[tKey]) {
          tPayload.stage_mode = 'quiz_qr';
          tPayload.reveal_winner = false;
        }
        var tResClick = await Store.adminAction(pin, 'update_settings', tPayload);
        if (tResClick && tResClick.ok) {
          await loadAdmin(false);
          if (tKey === 'reveal_quiz_winners') {
            flash(tPayload[tKey] ? 'Quiz Winners ANNOUNCED on 16:9 Live Screen!' : 'Quiz Winners HIDDEN on 16:9 Live Screen');
          } else {
            flash((tKey === 'quiz_open' ? 'Welcome Quiz ' : 'Final Voting ') + (tPayload[tKey] ? 'OPENED' : 'CLOSED'));
          }
        } else {
          flash((tResClick && tResClick.error) || 'Failed to update setting.', true);
        }
        return;
      }

      if (act === 'simulate-votes') {
        var simCount = Number(btn.getAttribute('data-count') || 5);
        await Store.adminAction(pin, 'simulate_votes', { count: simCount });
        await loadAdmin(false);
        flash('+' + simCount + ' simulated votes sent!');
        return;
      }

      if (act === 'enable-all-projects' && state.data) {
        var selEnPoll = ensureSelectedPoll(state.data);
        (state.data.projects || []).forEach(function (p) {
          if (selEnPoll && p.poll_id && p.poll_id !== selEnPoll.id) return;
          if (p.is_active === false || (state.dirtyProjects[p.id] && state.dirtyProjects[p.id].is_active === false)) {
            var cur = getProjectDraft(p);
            state.dirtyProjects[p.id] = {
              id: p.id,
              category_name: cur.category_name || '',
              project_title: cur.project_title,
              team_name: cur.team_name || '',
              is_active: true
            };
          }
        });
        render(false);
        flash('All poll options marked active — click Save to apply.');
        return;
      }

      if (act === 'open-confirm-modal') {
        var kind = btn.getAttribute('data-modal-kind') || 'reset';
        var itemId = btn.getAttribute('data-id');
        if (kind === 'reset') {
          var sc = btn.getAttribute('data-scope') || 'all';
          var modalMap = {
            votes: {
              title: 'Reset All Votes to 0?',
              message: 'This begins a clean new voting round (all project bars reset to 0 and rehearsal phones can vote again). Historical logs are kept safely.',
              confirmLabel: 'Reset Votes',
              action: 'reset_event_data',
              payload: { scope: 'votes' }
            },
            quiz: {
              title: 'Reset Quiz Submissions?',
              message: 'This starts a clean Welcome Quiz round and resets the voucher counter back to zero.',
              confirmLabel: 'Reset Quiz',
              action: 'reset_event_data',
              payload: { scope: 'quiz' }
            },
            all: {
              title: 'Go Live Clean — Reset All Event Data?',
              message: 'This resets BOTH Live Voting (0 votes) and the Quiz round into a clean live session.',
              confirmLabel: 'Reset Everything',
              action: 'reset_event_data',
              payload: { scope: 'all' }
            },
            seed: {
              title: 'Restore Sample Demo Data?',
              message: 'Replaces current browser demo data with the default seeded TEPA rehearsal dataset.',
              confirmLabel: 'Restore Sample Data',
              action: 'reset_event_data',
              payload: { scope: 'seed' }
            }
          };
          state.confirmModal = modalMap[sc] || modalMap.all;
        } else if (kind === 'archive_quiz') {
          state.confirmModal = {
            title: 'Delete This Quiz?',
            message: 'This removes the selected quiz from the studio list. If it is currently live, another quiz will automatically become active.',
            confirmLabel: 'Delete Quiz',
            action: 'archive_quiz',
            payload: { id: itemId }
          };
        } else if (kind === 'archive_poll') {
          state.confirmModal = {
            title: 'Delete This Voting Poll?',
            message: 'This removes the selected voting poll from the studio list. If it is currently live, another poll will automatically become active.',
            confirmLabel: 'Delete Poll',
            action: 'archive_poll',
            payload: { id: itemId }
          };
        } else if (kind === 'archive_question') {
          state.confirmModal = {
            title: 'Delete This Question?',
            message: 'This removes the question from this quiz. Existing historical scores are unaffected.',
            confirmLabel: 'Delete Question',
            action: 'archive_question',
            payload: { id: Number(itemId) }
          };
        } else if (kind === 'archive_project') {
          state.confirmModal = {
            title: 'Remove Project / Poll Option?',
            message: 'This removes the option from the Voting screen and Auditorium chart while keeping historical votes safe.',
            confirmLabel: 'Remove Option',
            action: 'archive_project',
            payload: { id: Number(itemId) }
          };
        }
        syncAdminModal();
        return;
      }

      if (act === 'cancel-confirm-modal') {
        state.confirmModal = null;
        syncAdminModal();
        return;
      }

      if (act === 'execute-confirm-modal' && state.confirmModal) {
        var modalSpec = state.confirmModal;
        state.confirmModal = null;
        syncAdminModal();
        var mRes = await Store.adminAction(pin, modalSpec.action, modalSpec.payload || {});
        if (mRes && mRes.ok) {
          if (modalSpec.action === 'archive_question' && modalSpec.payload) {
            delete state.dirtyQuestions[modalSpec.payload.id];
          } else if (modalSpec.action === 'archive_project' && modalSpec.payload) {
            delete state.dirtyProjects[modalSpec.payload.id];
          } else if (modalSpec.action === 'archive_quiz' && modalSpec.payload) {
            delete state.quizDrafts[modalSpec.payload.id];
            state.selectedQuizId = null;
          } else if (modalSpec.action === 'archive_poll' && modalSpec.payload) {
            delete state.pollDrafts[modalSpec.payload.id];
            state.selectedPollId = null;
            state.dirtyProjects = {};
          }
          await loadAdmin(false);
          flash('Updated!');
        } else {
          flash((mRes && mRes.error) || 'Action failed.', true);
        }
        return;
      }

      if (act === 'select-quiz') {
        state.selectedQuizId = btn.getAttribute('data-id');
        state.previewQIdx = 0;
        render(true);
        return;
      }

      if (act === 'create-quiz') {
        var nextIdx = ((state.data && state.data.quizzes) || []).length + 1;
        var cqRes = await Store.adminAction(pin, 'create_quiz', {
          title: 'TEPA Quiz ' + nextIdx,
          subtitle: 'Answer the questions below and see your result right away!',
          min_score: 1,
          voucher_enabled: true,
          voucher_title: 'Café Bonjour Breakfast Voucher',
          max_vouchers: 10,
          questions_per_page: 2
        });
        if (cqRes && cqRes.ok && cqRes.quiz) {
          state.selectedQuizId = cqRes.quiz.id;
          state.previewQIdx = 0;
          await loadAdmin(false);
          flash('New quiz created!');
        } else {
          flash((cqRes && cqRes.error) || 'Could not create quiz.', true);
        }
        return;
      }

      if (act === 'duplicate-quiz') {
        var srcQuizId = btn.getAttribute('data-id');
        var srcQuiz = ((state.data && state.data.quizzes) || []).find(function (q) { return q.id === srcQuizId; });
        var dupRes = await Store.adminAction(pin, 'create_quiz', {
          source_quiz_id: srcQuizId,
          title: (srcQuiz ? srcQuiz.title : 'Quiz') + ' (Copy)',
          subtitle: srcQuiz ? srcQuiz.subtitle : '',
          min_score: srcQuiz ? srcQuiz.min_score : 3,
          voucher_enabled: srcQuiz ? srcQuiz.voucher_enabled : true,
          voucher_title: srcQuiz ? srcQuiz.voucher_title : 'Café Bonjour Breakfast Voucher',
          max_vouchers: srcQuiz ? srcQuiz.max_vouchers : 10,
          questions_per_page: srcQuiz ? srcQuiz.questions_per_page : 2
        });
        if (dupRes && dupRes.ok && dupRes.quiz) {
          state.selectedQuizId = dupRes.quiz.id;
          state.previewQIdx = 0;
          await loadAdmin(false);
          flash('Quiz duplicated!');
        } else {
          flash((dupRes && dupRes.error) || 'Failed to duplicate quiz.', true);
        }
        return;
      }

      if (act === 'activate-quiz') {
        var actQuizId = btn.getAttribute('data-id');
        var resetRound = btn.getAttribute('data-reset') === 'true';
        var actRes = await Store.adminAction(pin, 'activate_quiz', { id: actQuizId, reset_round: resetRound });
        if (actRes && actRes.ok) {
          await loadAdmin(false);
          flash(resetRound ? 'Quiz activated with fresh round!' : 'Quiz is now LIVE on mobile!');
        } else {
          flash((actRes && actRes.error) || 'Failed to activate quiz.', true);
        }
        return;
      }

      if (act === 'select-poll') {
        state.selectedPollId = btn.getAttribute('data-id');
        state.projFilter = 'all';
        state.projSearch = '';
        render(true);
        return;
      }

      if (act === 'create-poll') {
        var nextPollIdx = ((state.data && state.data.polls) || []).length + 1;
        var newPollType = btn.getAttribute('data-polltype') === 'projects' ? 'projects' : 'simple';
        var cplRes = await Store.adminAction(pin, 'create_poll', {
          title: 'Event Poll ' + nextPollIdx,
          poll_type: newPollType,
          voting_headline: 'What should we prioritize in our next chapter?',
          voting_subtitle: 'Select one option below'
        });
        if (cplRes && cplRes.ok && cplRes.poll) {
          state.selectedPollId = cplRes.poll.id;
          state.projFilter = 'all';
          state.projSearch = '';
          await loadAdmin(false);
          flash('New voting poll created!');
        } else {
          flash((cplRes && cplRes.error) || 'Could not create poll.', true);
        }
        return;
      }

      if (act === 'duplicate-poll') {
        var srcPollId = btn.getAttribute('data-id');
        var srcPoll = ((state.data && state.data.polls) || []).find(function (pl) { return pl.id === srcPollId; });
        var dupPollRes = await Store.adminAction(pin, 'create_poll', {
          source_poll_id: srcPollId,
          poll_type: (srcPoll && srcPoll.poll_type) || 'projects',
          title: (srcPoll ? srcPoll.title : 'Poll') + ' (Copy)',
          voting_headline: srcPoll ? srcPoll.voting_headline : '',
          voting_subtitle: srcPoll ? srcPoll.voting_subtitle : ''
        });
        if (dupPollRes && dupPollRes.ok && dupPollRes.poll) {
          state.selectedPollId = dupPollRes.poll.id;
          state.projFilter = 'all';
          state.projSearch = '';
          await loadAdmin(false);
          flash('Voting poll duplicated!');
        } else {
          flash((dupPollRes && dupPollRes.error) || 'Failed to duplicate poll.', true);
        }
        return;
      }

      if (act === 'activate-poll') {
        var actPollId = btn.getAttribute('data-id');
        var resetPollRound = btn.getAttribute('data-reset') === 'true';
        var actPollRes = await Store.adminAction(pin, 'activate_poll', { id: actPollId, reset_round: resetPollRound });
        if (actPollRes && actPollRes.ok) {
          state.pollCopyDraft = null;
          await loadAdmin(false);
          flash(resetPollRound ? 'Voting poll is LIVE with fresh round!' : 'Voting poll is now LIVE on 16:9 & mobile!');
        } else {
          flash((actPollRes && actPollRes.error) || 'Failed to activate poll.', true);
        }
        return;
      }

      if (act === 'create-question') {
        var selQ = ensureSelectedQuiz(state.data);
        var qtype = btn.getAttribute('data-qtype') || 'yes_no';
        var newQRes = await Store.adminAction(pin, 'create_question', {
          quiz_id: selQ ? selQ.id : null,
          question_type: qtype,
          question_text: qtype === 'multiple_choice'
            ? 'Which priority is at the heart of TEPA 2026?'
            : 'Is innovation open to every employee at TotalEnergies?',
          options: qtype === 'multiple_choice' ? ['Safety & Operational Excellence', 'Energy Transition', 'Digital Innovation'] : [],
          correct_answer: true,
          correct_option: 0
        });
        if (newQRes && newQRes.ok) {
          await loadAdmin(false);
          flash('Question added!');
        } else {
          flash((newQRes && newQRes.error) || 'Could not add question.', true);
        }
        return;
      }

      if (act === 'set-q-type' && state.data) {
        var tqId = Number(btn.getAttribute('data-id'));
        var nextType = btn.getAttribute('data-qtype') === 'multiple_choice' ? 'multiple_choice' : 'yes_no';
        var tRow = root.querySelector('[data-q-row="' + tqId + '"]');
        var origTQ = (state.data.questions || []).find(function (q) { return q.id === tqId; });
        var baseDraft = tRow ? readQuestionRowToDirty(tRow) : getQuestionDraft(origTQ || { id: tqId });
        baseDraft.question_type = nextType;
        if (nextType === 'multiple_choice' && (!baseDraft.options || baseDraft.options.length < 2)) {
          baseDraft.options = ['Option A', 'Option B', 'Option C'];
          baseDraft.correct_option = 0;
        }
        state.dirtyQuestions[tqId] = baseDraft;
        render(false);
        return;
      }

      if (act === 'set-q-ans' && state.data) {
        var aqId = Number(btn.getAttribute('data-id'));
        var ansBool = btn.getAttribute('data-val') === 'true';
        var qRowEl = root.querySelector('[data-q-row="' + aqId + '"]');
        var curDraft = qRowEl ? readQuestionRowToDirty(qRowEl) : getQuestionDraft((state.data.questions || []).find(function (q) { return q.id === aqId; }) || { id: aqId });
        curDraft.correct_answer = ansBool;
        state.dirtyQuestions[aqId] = curDraft;
        if (qRowEl) {
          qRowEl.classList.add('is-dirty');
          qRowEl.querySelectorAll('[data-action="set-q-ans"]').forEach(function (sb) {
            sb.classList.toggle('is-active', sb.getAttribute('data-val') === String(ansBool));
          });
        }
        updateDirtyCountersInPlace();
        updatePhonePreviewInPlace();
        return;
      }

      if (act === 'set-q-correct-opt' && state.data) {
        var mcId = Number(btn.getAttribute('data-id'));
        var optIdx = Number(btn.getAttribute('data-opt-idx') || 0);
        var mcRow = root.querySelector('[data-q-row="' + mcId + '"]');
        var mcDraft = mcRow ? readQuestionRowToDirty(mcRow) : getQuestionDraft((state.data.questions || []).find(function (q) { return q.id === mcId; }) || { id: mcId });
        mcDraft.correct_option = optIdx;
        state.dirtyQuestions[mcId] = mcDraft;
        if (mcRow) {
          mcRow.classList.add('is-dirty');
          mcRow.querySelectorAll('[data-action="set-q-correct-opt"]').forEach(function (ob) {
            ob.classList.toggle('is-correct', Number(ob.getAttribute('data-opt-idx')) === optIdx);
          });
        }
        updateDirtyCountersInPlace();
        updatePhonePreviewInPlace();
        return;
      }

      if ((act === 'add-q-opt' || act === 'remove-q-opt') && state.data) {
        var oqId = Number(btn.getAttribute('data-id'));
        var oRow = root.querySelector('[data-q-row="' + oqId + '"]');
        var oDraft = oRow ? readQuestionRowToDirty(oRow) : getQuestionDraft((state.data.questions || []).find(function (q) { return q.id === oqId; }) || { id: oqId });
        var curOpts = (oDraft.options || ['Option A', 'Option B']).slice();
        if (act === 'add-q-opt' && curOpts.length < 4) {
          curOpts.push('Option ' + (LETTERS[curOpts.length] || (curOpts.length + 1)));
        } else if (act === 'remove-q-opt' && curOpts.length > 2) {
          var rmIdx = Number(btn.getAttribute('data-opt-idx') || 0);
          curOpts.splice(rmIdx, 1);
          if (oDraft.correct_option >= curOpts.length) oDraft.correct_option = curOpts.length - 1;
        }
        oDraft.options = curOpts;
        state.dirtyQuestions[oqId] = oDraft;
        render(false);
        return;
      }

      if (act === 'move-question' && state.data) {
        var mqId = Number(btn.getAttribute('data-id'));
        var dir = Number(btn.getAttribute('data-dir') || 0);
        var sQuiz = ensureSelectedQuiz(state.data);
        var qList = (state.data.questions || []).filter(function (q) {
          return !sQuiz || !q.quiz_id || q.quiz_id === sQuiz.id;
        });
        var curIdx = qList.findIndex(function (q) { return q.id === mqId; });
        var swapIdx = curIdx + dir;
        if (curIdx >= 0 && swapIdx >= 0 && swapIdx < qList.length) {
          var orderedIds = qList.map(function (q) { return q.id; });
          var tmp = orderedIds[curIdx];
          orderedIds[curIdx] = orderedIds[swapIdx];
          orderedIds[swapIdx] = tmp;
          await Store.adminAction(pin, 'reorder_questions', { ordered_ids: orderedIds });
          await loadAdmin(false);
          flash('Question order updated');
        }
        return;
      }

      if (act === 'save-question') {
        var qid = Number(btn.getAttribute('data-id'));
        var qrow = root.querySelector('[data-q-row="' + qid + '"]');
        if (qrow && state.data) {
          var dQ = readQuestionRowToDirty(qrow);
          await Store.adminAction(pin, 'save_question', dQ);
          delete state.dirtyQuestions[qid];
          await loadAdmin(false);
          flash('Question saved');
        }
        return;
      }

      if (act === 'discard-questions') {
        state.dirtyQuestions = {};
        render(false);
        flash('Unsaved question edits discarded');
        return;
      }

      if (act === 'save-all-questions') {
        var quizRows = Array.from(root.querySelectorAll('[data-q-row]'));
        var qItems = quizRows.length
          ? quizRows.map(readQuestionRowToDirty).filter(Boolean)
          : Object.values(state.dirtyQuestions);
        state.saving = true;
        render(false);
        try {
          var qBulkRes = await Store.adminAction(pin, 'save_questions_bulk', { items: qItems });
          if (qBulkRes && qBulkRes.ok) {
            qItems.forEach(function (it) { delete state.dirtyQuestions[it.id]; });
            await loadAdmin(false);
            flash('Saved ' + (qBulkRes.count || qItems.length) + ' questions!');
          } else {
            flash((qBulkRes && qBulkRes.error) || 'Failed to save questions.', true);
          }
        } finally {
          state.saving = false;
          render(false);
        }
        return;
      }

      if (act === 'create-project') {
        var selPl = ensureSelectedPoll(state.data);
        var plDraft = getPollDraft(selPl);
        var isSimplePl = Boolean(plDraft && plDraft.poll_type === 'simple');
        var pollOptCount = ((state.data && state.data.projects) || []).filter(function (p) {
          return !selPl || !p.poll_id || p.poll_id === selPl.id;
        }).length;
        var cpRes = await Store.adminAction(pin, 'create_project', {
          poll_id: selPl ? selPl.id : null,
          category_name: isSimplePl ? '' : 'New Category',
          project_title: isSimplePl ? ('Option ' + (pollOptCount + 1)) : 'New Finalist Project',
          team_name: isSimplePl ? '' : 'TEPA Team'
        });
        if (cpRes && cpRes.ok) {
          await loadAdmin(false);
          flash(isSimplePl ? 'New poll option added!' : 'New project added!');
        } else {
          flash((cpRes && cpRes.error) || 'Could not add item.', true);
        }
        return;
      }

      if (act === 'move-project' && state.data) {
        var mpId = Number(btn.getAttribute('data-id'));
        var pDir = Number(btn.getAttribute('data-dir') || 0);
        var selMovePoll = ensureSelectedPoll(state.data);
        var pList = (state.data.projects || []).filter(function (p) {
          return !selMovePoll || !p.poll_id || p.poll_id === selMovePoll.id;
        });
        var pIdx = pList.findIndex(function (p) { return p.id === mpId; });
        var pSwap = pIdx + pDir;
        if (pIdx >= 0 && pSwap >= 0 && pSwap < pList.length) {
          var ordPIds = pList.map(function (p) { return p.id; });
          var pTmp = ordPIds[pIdx];
          ordPIds[pIdx] = ordPIds[pSwap];
          ordPIds[pSwap] = pTmp;
          await Store.adminAction(pin, 'reorder_projects', { ordered_ids: ordPIds });
          await loadAdmin(false);
          flash('Order updated');
        }
        return;
      }

      if (act === 'save-project') {
        var pid = Number(btn.getAttribute('data-id'));
        var row = root.querySelector('[data-proj-row="' + pid + '"]');
        if (row) {
          var draftedSave = readProjectRowToDirty(row);
          if (draftedSave) {
            var spRes = await Store.adminAction(pin, 'save_project', draftedSave);
            if (spRes && spRes.ok) {
              delete state.dirtyProjects[pid];
              await loadAdmin(false);
              flash('Saved #' + pid);
            } else {
              flash((spRes && spRes.error) || 'Failed to save item.', true);
            }
          }
        }
        return;
      }

      if (act === 'discard-projects') {
        state.dirtyProjects = {};
        render(false);
        flash('Unsaved edits discarded');
        return;
      }

      if (act === 'save-all-projects') {
        var projRowsAll = Array.from(root.querySelectorAll('[data-proj-row]'));
        var pItems = Object.keys(state.dirtyProjects).length
          ? Object.values(state.dirtyProjects)
          : projRowsAll.map(readProjectRowToDirty).filter(Boolean);
        state.saving = true;
        render(false);
        try {
          var pBulkRes = await Store.adminAction(pin, 'save_projects_bulk', { items: pItems });
          if (pBulkRes && pBulkRes.ok) {
            state.dirtyProjects = {};
            await loadAdmin(false);
            flash('Saved ' + (pBulkRes.count || pItems.length) + ' items!');
          } else {
            flash((pBulkRes && pBulkRes.error) || 'Failed to save changes.', true);
          }
        } finally {
          state.saving = false;
          render(false);
        }
        return;
      }

      if (act === 'toggle-claim') {
        await Store.adminAction(pin, 'toggle_voucher_claimed', {
          id: btn.getAttribute('data-id'),
          voucher_claimed: btn.getAttribute('data-val') === 'true'
        });
        await loadAdmin(false);
        flash('Voucher status updated');
        return;
      }

      if (act === 'announce-quiz-winners') {
        var revealVal = btn.getAttribute('data-val') === 'true';
        var annPayload = { reveal_quiz_winners: revealVal };
        if (revealVal) {
          annPayload.stage_mode = 'quiz_qr';
          annPayload.reveal_winner = false;
        }
        var annRes = await Store.adminAction(pin, 'update_settings', annPayload);
        if (annRes && annRes.ok) {
          await loadAdmin(false);
          flash(revealVal ? 'Quiz Winners ANNOUNCED on 16:9 Live Screen!' : 'Quiz Winners HIDDEN on 16:9 Live Screen');
        } else {
          flash((annRes && annRes.error) || 'Failed to update announcement status.', true);
        }
        return;
      }

      if (act === 'export-csv') {
        downloadCsv((state.data && state.data.submissions) || []);
        return;
      }

      if (act === 'copy-text') {
        copyText(btn.getAttribute('data-text') || '', btn.getAttribute('data-label') || 'Value');
        return;
      }

      if (act === 'download-qr') {
        var targetId = btn.getAttribute('data-target');
        var fileName = btn.getAttribute('data-filename') || 'tepa-qr.svg';
        var box = root.querySelector('#' + targetId);
        if (box && box.innerHTML) {
          var svgBlob = new Blob([box.innerHTML], { type: 'image/svg+xml;charset=utf-8' });
          var svgUrl = URL.createObjectURL(svgBlob);
          var dl = document.createElement('a');
          dl.href = svgUrl;
          dl.download = fileName;
          dl.click();
          URL.revokeObjectURL(svgUrl);
        }
        return;
      }

      if (act === 'download-qr-png') {
        var pngTargetId = btn.getAttribute('data-target');
        var pngFileName = btn.getAttribute('data-filename') || 'tepa-qr.png';
        var pngBox = root.querySelector('#' + pngTargetId);
        if (pngBox && pngBox.innerHTML) {
          downloadQrPng(pngBox.innerHTML, pngFileName);
        }
      }
    });

    global.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 's' || ev.key === 'S')) {
        var pCount = Object.keys(state.dirtyProjects).length;
        var qCount = Object.keys(state.dirtyQuestions).length;
        if (pCount > 0 || qCount > 0) {
          ev.preventDefault();
          var targetAct = (pCount > 0 && (state.tab === 'projects' || qCount === 0)) ? 'save-all-projects' : 'save-all-questions';
          var saveBtn = root.querySelector('[data-action="' + targetAct + '"]');
          if (saveBtn) saveBtn.click();
        }
      }
    });

    loadAdmin(false);
    unsubscribe = Store.subscribeRealtime(function () {
      if (state.data) loadAdmin(true);
    });
    global.addEventListener('beforeunload', function () {
      if (unsubscribe) unsubscribe();
    });
  }

  // =========================================================================
  // Auto-Boot on DOMContentLoaded
  // =========================================================================

  function boot() {
    var nodes = document.querySelectorAll('[data-tepa-app]');
    nodes.forEach(function (el) {
      var appType = el.getAttribute('data-tepa-app');
      if (appType === 'quiz') mountQuizApp(el);
      else if (appType === 'vote') mountVoteApp(el);
      else if (appType === 'live') mountLiveApp(el);
      else if (appType === 'admin') mountAdminApp(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
