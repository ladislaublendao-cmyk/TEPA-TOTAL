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
    var fontStack = '"Gotham Rounded", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    var lightUpLogo = null;
    var teLogo = null;
    try {
      if (document.fonts && document.fonts.ready) {
        await Promise.all([
          document.fonts.ready,
          document.fonts.load('400 28px "Gotham Rounded"'),
          document.fonts.load('700 42px "Gotham Rounded"')
        ]);
      }
    } catch (e) {}
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
        if (opts.email) {
          rows.push({ label: 'EMAIL', value: opts.email });
        }
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
      var rowStep = rows.length <= 3 ? 128 : (rows.length === 4 ? 108 : 88);
      for (var rIdx = 0; rIdx < rows.length; rIdx++) {
        var item = rows[rIdx];
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#6B7085';
        ctx.font = '700 17px ' + fontStack;
        ctx.fillText(item.label, 148, curY);

        ctx.fillStyle = '#10121B';
        ctx.font = '700 ' + (rows.length >= 5 ? '23px ' : '25px ') + fontStack;
        var valLines = wrapCanvasText(ctx, item.value, 944, 2);
        for (var l = 0; l < valLines.length; l++) {
          ctx.fillText(valLines[l], 148, curY + 24 + l * 28);
        }

        if (rIdx < rows.length - 1) {
          var divY = curY + (valLines.length > 1 ? Math.min(82, rowStep - 10) : rowStep - 16);
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
          el.style.transition = 'transform 680ms cubic-bezier(0.22, 1, 0.36, 1)';
          el.style.transform = 'translate3d(0, 0, 0)';
          el._flipTimer = setTimeout(function () {
            el._flipTimer = 0;
            el.style.transition = '';
            el.style.transform = '';
          }, 710);
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
      email: '',
      emailStatus: 'idle', // 'idle' | 'sending' | 'sent' | 'simulated' | 'error'
      emailMessage: '',
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

    function isValidEmail(str) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(str || '').trim());
    }

    function buildEmailStatusHtml() {
      var r = state.receipt;
      var targetEmail = (r && r.email) || state.email || '';
      if (!targetEmail) return '';
      if (state.emailStatus === 'sending') {
        return (
          '<div class="tepa-email-status is-sending">' +
          '  <span>Sending code to <strong>' + esc(targetEmail) + '</strong>...</span>' +
          '</div>'
        );
      }
      if (state.emailStatus === 'sent') {
        return (
          '<div class="tepa-email-status is-sent">' +
          '  <span class="tepa-email-check" aria-hidden="true">✓</span>' +
          '  <span>Sent to <strong>' + esc(targetEmail) + '</strong></span>' +
          '</div>'
        );
      }
      if (state.emailStatus === 'simulated') {
        return (
          '<div class="tepa-email-status is-simulated">' +
          '  <span>Email: <strong>' + esc(targetEmail) + '</strong></span>' +
          '</div>'
        );
      }
      if (state.emailStatus === 'error') {
        return (
          '<div class="tepa-email-status is-error">' +
          '  <span>' + esc(state.emailMessage || 'Could not send email automatically.') + '</span>' +
          '  <button type="button" class="tepa-email-retry-btn" data-action="resend-code-email">Resend</button>' +
          '</div>'
        );
      }
      return (
        '<div class="tepa-email-status is-idle">' +
        '  <span><strong>' + esc(targetEmail) + '</strong></span>' +
        '  <button type="button" class="tepa-email-retry-btn" data-action="resend-code-email">Resend code</button>' +
        '</div>'
      );
    }

    function updateEmailStatusInPlace() {
      var slot = root.querySelector('#tepa-email-status-slot');
      if (slot) {
        slot.innerHTML = buildEmailStatusHtml();
      }
    }

    async function dispatchQuizCodeEmail(isResend) {
      var r = state.receipt;
      var targetEmail = (r && r.email) || state.email || '';
      if (!r || !r.unique_code || !targetEmail) return;
      state.emailStatus = 'sending';
      state.emailMessage = '';
      updateEmailStatusInPlace();
      try {
        var mailRes = await Store.sendQuizCodeEmail({
          fullName: r.full_name || state.fullName,
          email: targetEmail,
          uniqueCode: r.unique_code,
          eventTitle: (state.activeQuiz && state.activeQuiz.title) || 'TEPA Performance Award 2026',
          resend: Boolean(isResend)
        });
        if (mailRes && mailRes.simulated) {
          state.emailStatus = 'simulated';
          state.emailMessage = mailRes.message || 'Preview mode — automatic email activates on WordPress.';
        } else if (mailRes && mailRes.ok && mailRes.sent) {
          state.emailStatus = 'sent';
          state.emailMessage = '';
          if (state.receipt) state.receipt.email_sent = true;
        } else {
          state.emailStatus = 'error';
          state.emailMessage = (mailRes && mailRes.error) || 'Could not send email automatically.';
        }
      } catch (err) {
        state.emailStatus = 'error';
        state.emailMessage = (err && err.message) || 'Could not send email automatically.';
      }
      updateEmailStatusInPlace();
    }

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
      return state.answers[String(q.id)];
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
          state.email = cached.email || '';
          state.emailStatus = cached.email_sent ? 'sent' : 'idle';
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
          '  <form id="tepa-quiz-name-form" class="tepa-gradient-card" style="margin-top:6px;" novalidate>' +
          '    <label class="tepa-input-label" for="tepa-quiz-fullname">Your Full Name</label>' +
          '    <input id="tepa-quiz-fullname" class="tepa-dark-input" type="text" maxlength="80" autocomplete="name" placeholder="e.g. Maria João Silva" value="' + esc(state.fullName) + '" required>' +
          '    <div class="tepa-field-group">' +
          '      <label class="tepa-input-label" for="tepa-quiz-email">Your Email Address</label>' +
          '      <input id="tepa-quiz-email" class="tepa-dark-input" type="email" inputmode="email" maxlength="120" autocomplete="email" placeholder="e.g. maria.silva@totalenergies.com" value="' + esc(state.email) + '" required>' +
          '      <p class="tepa-input-helper">Your unique access code will be sent automatically to this email.</p>' +
          '    </div>' +
          (state.error ? '<p style="color:#FF8B8E;font-size:13px;margin:10px 0 0;">' + esc(state.error) + '</p>' : '') +
          '    <div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">' +
          '      <button type="submit" class="tepa-btn-cta" style="width:100%;">Start Quiz</button>' +
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
          var errBox = root.querySelector('#tepa-quiz-err');
          if (fillEl) fillEl.style.width = prog.pct + '%';
          if (pctEl) animateNumber(pctEl, prog.pct, function (v) { return Math.round(v) + '%'; }, 360);
          if (pgLbl) pgLbl.textContent = (state.page + 1) + '/' + totalPages;
          if (nxtBtn) {
            nxtBtn.disabled = !(allPageAnswered && !state.submitting);
            nxtBtn.textContent = state.submitting ? 'Submitting...' : (isLast ? 'Submit Answers' : 'Next');
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
          '  </div>' +
          '</div>';
      } else if (state.step === 'result' && state.receipt) {
        var r = state.receipt;
        var voucherHtml =
          '<div class="tepa-gradient-card tepa-anim-enter" style="text-align:center;margin:14px 0 12px;">' +
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
          '    <div class="tepa-unique-id-kicker">Unique Participant ID</div>' +
          '    <div class="tepa-unique-id-code" id="tepa-unique-code-val">' + esc(r.unique_code) + '</div>' +
          '    <div class="tepa-unique-id-name">' + esc(r.full_name) + '</div>' +
          '    <div id="tepa-email-status-slot">' + buildEmailStatusHtml() + '</div>' +
          '    <div class="tepa-unique-id-divider"></div>' +
          '    <div class="tepa-receipt-actions">' +
          '      <button type="button" class="tepa-stage-btn" data-action="copy-code">Copy Unique ID</button>' +
          '      <button type="button" class="tepa-stage-btn is-pdf" data-action="download-quiz-pdf">' + PDF_ICON_SVG + '<span>Save PDF Receipt</span></button>' +
          '    </div>' +
          '  </div>' +
          renderDemoResetPill() +
          '</div>';
      }
    }

    root.addEventListener('submit', function (ev) {
      if (ev.target && ev.target.id === 'tepa-quiz-name-form') {
        ev.preventDefault();
        var nameInput = root.querySelector('#tepa-quiz-fullname');
        var emailInput = root.querySelector('#tepa-quiz-email');
        var nameVal = (nameInput ? nameInput.value : '').trim();
        var emailVal = (emailInput ? emailInput.value : '').trim().toLowerCase();
        state.fullName = nameVal;
        state.email = emailVal;
        if (nameVal.length < 2) {
          state.error = 'Please enter your full name (at least 2 characters).';
          render();
          return;
        }
        if (!emailVal || !isValidEmail(emailVal)) {
          state.error = 'Please enter a valid email address so we can send your access code.';
          render();
          var eInp = root.querySelector('#tepa-quiz-email');
          if (eInp) setTimeout(function () { try { eInp.focus(); } catch (e) {} }, 40);
          return;
        }
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
      } else if (action === 'answer') {
        var qId = btn.getAttribute('data-qid');
        var qtype = btn.getAttribute('data-qtype');
        var rawVal = btn.getAttribute('data-val');
        var typedVal = qtype === 'multiple_choice' ? Number(rawVal) : (rawVal === 'true');
        state.answers[String(qId)] = typedVal;
        updateQuestionsUiInPlace();
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
            var res = await Store.submitQuizAttempt(state.fullName, state.answers, state.email);
            if (!res || !res.ok) {
              state.error = (res && res.error) || 'Could not submit your quiz.';
              state.submitting = false;
              render();
              return;
            }
            if (!res.email && state.email) {
              res.email = state.email;
            }
            state.receipt = res;
            state.step = 'result';
            var shouldAutoEmail = Boolean(res.email && !res.already_submitted);
            state.emailStatus = shouldAutoEmail ? 'sending' : (res.email_sent ? 'sent' : 'idle');
            state.emailMessage = '';
            state.submitting = false;
            render('next');
            if (shouldAutoEmail) {
              dispatchQuizCodeEmail(false);
            }
          } catch (err) {
            state.error = (err && err.message) || 'Network error while submitting.';
            state.submitting = false;
            render();
          }
        }
      } else if (action === 'resend-code-email') {
        if (state.receipt && state.emailStatus !== 'sending') {
          await dispatchQuizCodeEmail(true);
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
              email: state.receipt.email || state.email || '',
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
        state.email = '';
        state.emailStatus = 'idle';
        state.emailMessage = '';
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

    var shellSwapTimer = 0;
    var pendingShellSwap = null;

    function swapShellHtml(shell, html, stepChanged, afterMount) {
      var canFade = stepChanged && !prefersReducedMotion() && shell.firstElementChild;
      if (!canFade) {
        if (shellSwapTimer) {
          clearTimeout(shellSwapTimer);
          shellSwapTimer = 0;
        }
        pendingShellSwap = null;
        shell.classList.remove('is-swapping');
        shell.innerHTML = html;
        if (afterMount) afterMount();
        return;
      }
      pendingShellSwap = { html: html, after: afterMount };
      shell.classList.add('is-swapping');
      if (shellSwapTimer) return;
      shellSwapTimer = setTimeout(function () {
        shellSwapTimer = 0;
        var job = pendingShellSwap;
        pendingShellSwap = null;
        shell.classList.remove('is-swapping');
        if (!job) return;
        shell.innerHTML = job.html;
        shell.scrollTop = 0;
        if (job.after) job.after();
      }, 180);
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
      if (stepChanged && !shellSwapTimer) shell.scrollTop = 0;

      if (state.loading || state.step === 'loading') {
        swapShellHtml(shell,
          '<div class="tepa-mobile-content" style="align-items:center;justify-content:center;padding:32px;text-align:center;">' +
          '  <img class="tepa-lightup-logo" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">' +
          '  <p style="margin-top:18px;color:#C7C9D9;">Loading Voting System...</p>' +
          '</div>' + renderFooter(), stepChanged);
        return;
      }

      var isSimple = isSimpleMode();

      if (state.step === 'cover') {
        swapShellHtml(shell,
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
          renderFooter(), stepChanged);
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

        swapShellHtml(shell,
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
          '</main>', stepChanged, syncModalInPlace);
      } else if (state.step === 'receipt' && state.receipt) {
        var votedProj = state.projects.find(function (p) { return p.id === state.receipt.project_id; });
        var pollLabel = (state.activePoll && state.activePoll.title) || 'TEPA Performance Award 2026';
        var receiptCat = votedProj && votedProj.category_name
          ? '<div style="font-size:12px;color:#FFD239;font-weight:700;text-transform:uppercase;margin-top:4px;">' + esc(pad2(votedProj.slot_number)) + ' · ' + esc(votedProj.category_name) + '</div>'
          : '';
        var demoResetHtml = renderDemoVoteReset();
        swapShellHtml(shell,
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
          (demoResetHtml
            ? '    <div style="width:100%;display:flex;flex-direction:column;gap:10px;margin-top:6px;">' + demoResetHtml + '</div>'
            : '') +
          '  </div>' +
          '</div>' +
          renderFooter(), stepChanged);
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
      '#4E6AF5', '#FF6B6B', '#8E9BFF', '#F77B39', '#2194D4',
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

    var stageAnimRaf = 0;
    var stageAnimLastTs = 0;
    var stageAnimBars = new Map();
    var stageAnimNums = new Map();
    var lastReorderAt = 0;
    var REORDER_COOLDOWN_MS = 900;
    var stageSwapTimer = 0;
    var stageSwapRaf = 0;
    var pendingStageMount = null;
    var confettiRaf = 0;
    var confettiResizeHandler = null;

    function stopStageConfetti() {
      if (confettiRaf) {
        cancelAnimationFrame(confettiRaf);
        confettiRaf = 0;
      }
      if (confettiResizeHandler) {
        global.removeEventListener('resize', confettiResizeHandler);
        confettiResizeHandler = null;
      }
      root.querySelectorAll('.tepa-menti-confetti').forEach(function (c) { c.remove(); });
    }

    function launchStageConfetti() {
      stopStageConfetti();
      var host = root.querySelector('.tepa-winner-stage') || root.querySelector('.tepa-menti-stage');
      if (!host) return;

      var canvas = document.createElement('canvas');
      canvas.className = 'tepa-menti-confetti';
      host.appendChild(canvas);

      var W = 0;
      var H = 0;
      var dpr = 1;
      var ctx = canvas.getContext('2d');
      if (!ctx) { canvas.remove(); return; }

      function syncCanvasSize() {
        dpr = Math.min(2, global.devicePixelRatio || 1);
        W = Math.max(1, host.clientWidth);
        H = Math.max(1, host.clientHeight);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      syncCanvasSize();
      confettiResizeHandler = syncCanvasSize;
      global.addEventListener('resize', confettiResizeHandler);

      var palette = ['#F77B39', '#E72428', '#FFD239', '#2194D4', '#64BD75', '#8F4F9E'];
      var reduced = prefersReducedMotion();

      function pickKind() {
        var r = Math.random();
        if (r < 0.56) return 'rect';
        if (r < 0.78) return 'ribbon';
        if (r < 0.92) return 'dot';
        return 'star';
      }

      function pickColor(i) {
        return Math.random() < 0.9 ? palette[i % palette.length] : '#FFFFFF';
      }

      function spawnAmbient(i, anywhereY) {
        var zone = i % 5;
        var x;
        var y;
        if (zone === 0 || zone === 1) {
          x = (0.02 + Math.random() * 0.30) * W;
          y = anywhereY ? (Math.random() * H) : (-20 - Math.random() * H * 1.05);
        } else if (zone === 2 || zone === 3) {
          x = (0.68 + Math.random() * 0.30) * W;
          y = anywhereY ? (Math.random() * H) : (-20 - Math.random() * H * 1.05);
        } else {
          x = (0.24 + Math.random() * 0.52) * W;
          y = anywhereY ? (Math.random() * H * 0.24) : (-20 - Math.random() * H * 0.95);
        }
        var scale = Math.min(1.15, Math.max(0.68, W / 1600));
        return {
          mode: 'ambient',
          kind: pickKind(),
          x: x,
          y: y,
          baseX: x,
          vy: (32 + Math.random() * 44) * scale,
          swayAmp: (12 + Math.random() * 24) * scale,
          swayFreq: 0.7 + Math.random() * 1.1,
          phase: Math.random() * Math.PI * 2,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 1.6,
          tumblePhase: Math.random() * Math.PI * 2,
          tumbleSpeed: 1.4 + Math.random() * 2.2,
          size: (11 + Math.random() * 10) * scale,
          aspect: 0.44 + Math.random() * 0.22,
          color: pickColor(i),
          alpha: 0.48 + Math.random() * 0.44,
          zone: zone
        };
      }

      var pieces = [];
      var AMBIENT_COUNT = 100;

      function getConeMouths() {
        var hostRect = host.getBoundingClientRect();
        var leftEl = host.querySelector('.tepa-winner-cone.is-left');
        var rightEl = host.querySelector('.tepa-winner-cone.is-right');
        var lMouth = { x: W * 0.10, y: H * 0.80 };
        var rMouth = { x: W * 0.90, y: H * 0.80 };
        if (leftEl && hostRect.width > 0) {
          var lr = leftEl.getBoundingClientRect();
          if (lr.width > 0) {
            lMouth = {
              x: (lr.left - hostRect.left) + lr.width * 0.66,
              y: (lr.top - hostRect.top) + lr.height * 0.29
            };
          }
        }
        if (rightEl && hostRect.width > 0) {
          var rr = rightEl.getBoundingClientRect();
          if (rr.width > 0) {
            rMouth = {
              x: (rr.left - hostRect.left) + rr.width * 0.34,
              y: (rr.top - hostRect.top) + rr.height * 0.29
            };
          }
        }
        return { left: lMouth, right: rMouth };
      }

      function fireConeBurst(count, power) {
        var mouths = getConeMouths();
        var bScale = Math.min(1.18, Math.max(0.68, W / 1550)) * (power || 1);
        for (var b = 0; b < count; b++) {
          var fromLeft = b % 2 === 0;
          var origin = fromLeft ? mouths.left : mouths.right;
          var spreadDeg = fromLeft
            ? (-26 - Math.random() * 48)
            : (-106 - Math.random() * 48);
          var rad = spreadDeg * Math.PI / 180;
          var speed = (580 + Math.random() * 520) * bScale;
          pieces.push({
            mode: 'burst',
            kind: pickKind(),
            x: origin.x + (Math.random() - 0.5) * 18,
            y: origin.y + (Math.random() - 0.5) * 18,
            vx: Math.cos(rad) * speed,
            vy: Math.sin(rad) * speed,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 8.2,
            tumblePhase: Math.random() * Math.PI * 2,
            tumbleSpeed: 4 + Math.random() * 5,
            size: (11 + Math.random() * 9) * Math.min(1.15, Math.max(0.7, W / 1600)),
            aspect: 0.45 + Math.random() * 0.2,
            color: pickColor(b),
            alpha: 0.94,
            delay: Math.random() * 0.14,
            age: 0,
            life: 3.1 + Math.random() * 1.2
          });
        }
      }

      if (reduced) {
        for (var rSpawn = 0; rSpawn < AMBIENT_COUNT; rSpawn++) {
          pieces.push(spawnAmbient(rSpawn, true));
        }
      }

      function drawPiece(p, alpha) {
        if (alpha <= 0.01) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);

        if (p.kind === 'rect') {
          var rw = p.size;
          var rh = Math.max(3, p.size * p.aspect * (0.45 + 0.55 * Math.abs(Math.cos(p.tumblePhase))));
          var rad = Math.min(rw, rh) * 0.22;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(-rw / 2, -rh / 2, rw, rh, rad);
          } else {
            ctx.rect(-rw / 2, -rh / 2, rw, rh);
          }
          ctx.fill();
        } else if (p.kind === 'ribbon') {
          var len = p.size * 1.65;
          var amp = p.size * 0.36;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(2.2, p.size * 0.22);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-len / 2, 0);
          ctx.quadraticCurveTo(-len / 4, -amp, 0, 0);
          ctx.quadraticCurveTo(len / 4, amp, len / 2, 0);
          ctx.stroke();
        } else if (p.kind === 'dot') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(2.6, p.size * 0.28), 0, Math.PI * 2);
          ctx.fill();
        } else {
          var s = Math.max(5.5, p.size * 0.56);
          var k = s * 0.28;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(k, -k);
          ctx.lineTo(s, 0);
          ctx.lineTo(k, k);
          ctx.lineTo(0, s);
          ctx.lineTo(-k, k);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-k, -k);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      if (reduced) {
        ctx.clearRect(0, 0, W, H);
        for (var rIdx = 0; rIdx < pieces.length; rIdx++) {
          drawPiece(pieces[rIdx], pieces[rIdx].alpha);
        }
        return;
      }

      var startTs = 0;
      var lastTs = 0;
      var burstFired = false;
      var ambientStarted = false;

      function stepPhysics(stepDt, wallSec) {
        for (var j = pieces.length - 1; j >= 0; j--) {
          var p = pieces[j];
          if (p.mode === 'burst') {
            p.age += stepDt;
            if (p.age < p.delay) continue;
            var tAge = p.age - p.delay;
            if (tAge >= p.life || p.y > H + 40) {
              pieces.splice(j, 1);
              continue;
            }
            p.vy += 520 * stepDt;
            p.vx *= Math.pow(0.45, stepDt);
            p.x += p.vx * stepDt;
            p.y += p.vy * stepDt;
            p.rot += p.vr * stepDt;
            p.tumblePhase += p.tumbleSpeed * stepDt;
          } else {
            p.y += p.vy * stepDt;
            p.x = p.baseX + Math.sin(wallSec * p.swayFreq + p.phase) * p.swayAmp;
            p.rot += p.vr * stepDt;
            p.tumblePhase += p.tumbleSpeed * stepDt;
            if (p.y > H + 28) {
              pieces[j] = spawnAmbient(j, false);
            }
          }
        }
      }

      function frame(ts) {
        if (!canvas.isConnected) {
          stopStageConfetti();
          return;
        }
        if (!startTs) {
          startTs = ts;
          lastTs = ts;
        }
        var wallSec = Math.max(0, (ts - startTs) / 1000);
        var rawDt = Math.min(0.30, Math.max(0.004, (ts - lastTs) / 1000));
        lastTs = ts;

        // Beat 2 (~460ms wall-clock): Cones reach firing stance and launch the opening burst
        if (!burstFired && wallSec >= 0.46) {
          burstFired = true;
          fireConeBurst(110, 1.15);
        }

        // Beat 4 (~1.35s wall-clock): As cones begin exiting, background confetti starts descending from above
        if (!ambientStarted && wallSec >= 1.35) {
          ambientStarted = true;
          for (var a = 0; a < AMBIENT_COUNT; a++) {
            pieces.push(spawnAmbient(a, false));
          }
        }

        // Substep physics so speed stays true to wall-clock time even on throttled frames
        var substeps = Math.max(1, Math.ceil(rawDt / 0.04));
        var subDt = rawDt / substeps;
        for (var st = 0; st < substeps; st++) {
          stepPhysics(subDt, wallSec);
        }

        ctx.clearRect(0, 0, W, H);
        for (var k = 0; k < pieces.length; k++) {
          var pk = pieces[k];
          if (pk.mode === 'burst') {
            if (pk.age < pk.delay) continue;
            var tAge = pk.age - pk.delay;
            var bFade = tAge > pk.life - 0.8 ? Math.max(0, (pk.life - tAge) / 0.8) : 1;
            drawPiece(pk, pk.alpha * bFade);
          } else {
            var centerFade = 1;
            if (pk.x > W * 0.29 && pk.x < W * 0.71 && pk.y > H * 0.23 && pk.y < H * 0.90) {
              centerFade = 0.14;
            }
            var edgeFade = pk.y < 36 ? Math.max(0, (pk.y + 18) / 54) : (pk.y > H - 48 ? Math.max(0, (H + 16 - pk.y) / 64) : 1);
            drawPiece(pk, pk.alpha * centerFade * edgeFade);
          }
        }
        confettiRaf = requestAnimationFrame(frame);
      }
      confettiRaf = requestAnimationFrame(frame);
    }

    function stopStageAnimator() {
      if (stageAnimRaf) {
        cancelAnimationFrame(stageAnimRaf);
        stageAnimRaf = 0;
      }
      stageAnimLastTs = 0;
      stageAnimBars.clear();
      stageAnimNums.clear();
    }

    function stepStageAnimator(now) {
      if (!stageAnimLastTs) stageAnimLastTs = now;
      var dt = Math.min(0.25, Math.max(0.004, (now - stageAnimLastTs) / 1000));
      stageAnimLastTs = now;
      var alpha = prefersReducedMotion() ? 1 : (1 - Math.exp(-dt * 4.5));
      var keepGoing = false;
      var vBarsWrap = root.querySelector('.tepa-menti-vbars');
      var vWrapH = vBarsWrap ? Math.max(0, vBarsWrap.clientHeight - 46) : 0;

      stageAnimBars.forEach(function (b, el) {
        if (!el || !el.isConnected) {
          stageAnimBars.delete(el);
          return;
        }
        var diff = b.target - b.cur;
        if (Math.abs(diff) < 0.04 || alpha >= 1) {
          b.cur = b.target;
        } else {
          b.cur += diff * alpha;
          keepGoing = true;
        }
        el._tepaBarCur = b.cur;
        if (b.mode === 'h') {
          var tx = b.isZero ? 'calc(-100% + 6px)' : ('-' + Math.max(0, 100 - b.cur).toFixed(2) + '%');
          el.style.transform = 'translate3d(' + tx + ', 0, 0)';
        } else {
          var ty = Math.max(0, 100 - b.cur).toFixed(2);
          el.style.transform = 'translate3d(0, ' + ty + '%, 0)';
          if (b.countEl && vWrapH > 0) {
            var countOffset = (b.cur / 100) * vWrapH + 6;
            b.countEl.style.transform = 'translate3d(0, -' + countOffset.toFixed(1) + 'px, 0)';
          }
        }
      });

      stageAnimNums.forEach(function (n, el) {
        if (!el || !el.isConnected) {
          stageAnimNums.delete(el);
          return;
        }
        var ndiff = n.target - n.cur;
        if (Math.abs(ndiff) < 0.15 || alpha >= 1) {
          n.cur = n.target;
        } else {
          n.cur += ndiff * alpha;
          keepGoing = true;
        }
        el._tepaNumVal = n.cur;
        var nextTxt = n.fmt(n.cur);
        if (el.textContent !== nextTxt) el.textContent = nextTxt;
      });

      if (keepGoing) {
        stageAnimRaf = requestAnimationFrame(stepStageAnimator);
      } else {
        stageAnimRaf = 0;
        stageAnimLastTs = 0;
      }
    }

    function ensureStageAnimator() {
      if (!stageAnimRaf) {
        stageAnimLastTs = 0;
        stageAnimRaf = requestAnimationFrame(stepStageAnimator);
      }
    }

    function setAnimatedBar(el, targetPct, mode, isZero, startFromZero, countEl) {
      if (!el) return;
      var target = Number(targetPct) || 0;
      var entry = stageAnimBars.get(el);
      if (!entry) {
        var initCur = startFromZero ? 0 : (el._tepaBarCur !== undefined ? el._tepaBarCur : target);
        entry = { cur: initCur, target: target, mode: mode, isZero: Boolean(isZero), countEl: countEl || null };
        stageAnimBars.set(el, entry);
      } else {
        entry.target = target;
        entry.mode = mode;
        entry.isZero = Boolean(isZero);
        if (countEl) entry.countEl = countEl;
      }
      if (prefersReducedMotion()) {
        entry.cur = target;
        el._tepaBarCur = target;
        if (mode === 'h') {
          var tx = entry.isZero ? 'calc(-100% + 6px)' : ('-' + Math.max(0, 100 - target).toFixed(2) + '%');
          el.style.transform = 'translate3d(' + tx + ', 0, 0)';
        } else {
          el.style.transform = 'translate3d(0, ' + Math.max(0, 100 - target).toFixed(2) + '%, 0)';
          if (entry.countEl) {
            var vBarsWrap = root.querySelector('.tepa-menti-vbars');
            var vWrapH = vBarsWrap ? Math.max(0, vBarsWrap.clientHeight - 46) : 0;
            if (vWrapH > 0) {
              entry.countEl.style.transform = 'translate3d(0, -' + ((target / 100) * vWrapH + 6).toFixed(1) + 'px, 0)';
            }
          }
        }
        return;
      }
      ensureStageAnimator();
    }

    function setAnimatedNum(el, targetVal, fmt, initialFrom) {
      if (!el) return;
      var target = Number(targetVal);
      if (!isFinite(target)) target = 0;
      var formatter = fmt || function (v) { return String(Math.round(v)); };
      var entry = stageAnimNums.get(el);
      if (!entry) {
        var initCur = el._tepaNumVal !== undefined
          ? el._tepaNumVal
          : (initialFrom !== undefined ? Number(initialFrom) : target);
        entry = { cur: initCur, target: target, fmt: formatter };
        stageAnimNums.set(el, entry);
      } else {
        entry.target = target;
        entry.fmt = formatter;
      }
      if (prefersReducedMotion()) {
        entry.cur = target;
        el._tepaNumVal = target;
        el.textContent = formatter(target);
        return;
      }
      ensureStageAnimator();
    }

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
          var explicitChartParam = urlParams.get('chart');
          if (explicitChartParam !== 'vertical' && explicitChartParam !== 'horizontal' && (s.live_chart_type === 'vertical' || s.live_chart_type === 'horizontal')) {
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

    function applyLeaderState(leaderId, active) {
      var stageCard = root.querySelector('.tepa-vote-stage');
      if (!stageCard) return;
      var isActive = Boolean(active) && leaderId !== null && leaderId !== undefined;
      stageCard.classList.toggle('has-leader', isActive);
      var idStr = isActive ? String(leaderId) : '';
      stageCard.querySelectorAll('.tepa-menti-hrow[data-project-id], .tepa-menti-vcol[data-project-id], .tepa-menti-vlabel[data-label-id]').forEach(function (el) {
        var pid = el.getAttribute('data-project-id') || el.getAttribute('data-label-id');
        el.classList.toggle('is-leader', isActive && pid === idStr);
      });
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
      displayList.forEach(function (p) {
        var row = nodes[String(p.id)];
        if (!row) return;
        orderedRows.push(row);
        var v = Number(p.votes || 0);
        var sharePct = (!state.hideResults && totalVotes > 0) ? Math.round((v / totalVotes) * 100) : 0;
        var isZero = !state.hideResults && v === 0;
        var barPct = isZero ? 0 : ((!state.hideResults && maxVotes > 0 && v > 0) ? Math.max(2.5, (v / maxVotes) * 100) : 1);
        var barPctStr = isZero ? '0' : barPct.toFixed(2);

        var titleEl = row.querySelector('.tepa-menti-htitle');
        if (titleEl && titleEl.textContent !== p.project_title) titleEl.textContent = p.project_title;
        var catEl = row.querySelector('.tepa-menti-hcat');
        var nextCat = formatStageCat(p);
        if (catEl && catEl.textContent !== nextCat) catEl.textContent = nextCat;

        var numEl = row.querySelector('.tepa-hnum');
        var pctEl = row.querySelector('.tepa-menti-hpct');
        if (numEl) {
          if (state.hideResults) numEl.textContent = '';
          else setAnimatedNum(numEl, v, function (n) { var r = Math.round(n); return r + (r === 1 ? ' vote' : ' votes'); });
        }
        if (pctEl) {
          if (state.hideResults) pctEl.textContent = '••';
          else setAnimatedNum(pctEl, sharePct, function (n) { return Math.round(n) + '%'; });
        }

        var fillEl = row.querySelector('.tepa-menti-hfill');
        if (fillEl) {
          fillEl.classList.toggle('is-zero', isZero);
          fillEl.style.backgroundColor = colorFor(p);
          fillEl.setAttribute('data-target-pct', barPctStr);
          setAnimatedBar(fillEl, barPct, 'h', isZero, false);
        }
      });

      if (orderedRows.length === displayList.length) {
        var currentRows = Array.from(listEl.children);
        var orderChanged = currentRows.length !== orderedRows.length || currentRows.some(function (el, idx) {
          return el !== orderedRows[idx];
        });
        if (orderChanged && (Date.now() - lastReorderAt >= REORDER_COOLDOWN_MS)) {
          lastReorderAt = Date.now();
          flipReorderChildren(listEl, orderedRows);
        }
      }

      Array.from(listEl.children).forEach(function (rowEl, visualIdx) {
        var rankEl = rowEl.querySelector('.tepa-menti-hrank');
        var nextRank = (visualIdx + 1) + '.';
        if (rankEl && rankEl.textContent !== nextRank) rankEl.textContent = nextRank;
      });

      var waitEl = root.querySelector('#tepa-menti-wait-text');
      if (waitEl) {
        waitEl.textContent = totalVotes === 0
          ? 'Waiting for participants'
          : totalVotes + (totalVotes === 1 ? ' vote received' : ' votes received');
      }
      var countPill = root.querySelector('#tepa-menti-total-pill');
      if (countPill) setAnimatedNum(countPill, totalVotes, function (n) { return String(Math.round(n)); });
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
        var barH = (!state.hideResults && maxVotes > 0 && v > 0) ? Math.max(4, (v / maxVotes) * 96) : 3;
        var barHStr = barH.toFixed(2);

        if (repurposed && lbl.children.length >= 2) {
          lbl.children[0].textContent = p.project_title;
          lbl.children[1].textContent = formatStageCat(p);
        }

        var numEl = col.querySelector('.tepa-vnum');
        var pctEl = col.querySelector('.tepa-menti-vcount-pct');
        if (numEl) {
          if (repurposed) {
            numEl._tepaNumVal = v;
            stageAnimNums.delete(numEl);
          }
          if (state.hideResults) numEl.textContent = '•';
          else setAnimatedNum(numEl, v, function (n) { return String(Math.round(n)); });
        }
        if (pctEl) {
          if (repurposed) {
            pctEl._tepaNumVal = sharePct;
            stageAnimNums.delete(pctEl);
          }
          if (state.hideResults) pctEl.textContent = '';
          else setAnimatedNum(pctEl, sharePct, function (n) { return Math.round(n) + '%'; });
        }

        var barEl = col.querySelector('.tepa-menti-vbar');
        if (barEl) {
          barEl.style.backgroundColor = colorFor(p);
          barEl.setAttribute('data-target-pct', barHStr);
          setAnimatedBar(barEl, barH, 'v', false, false, col.querySelector('.tepa-menti-vcount'));
        }
      });

      if (orderedCols.length === visibleCols.length) {
        var curCols = Array.from(barsWrap.children);
        var vOrderChanged = curCols.length !== orderedCols.length || curCols.some(function (el, idx) {
          return el !== orderedCols[idx];
        });
        if (vOrderChanged && (Date.now() - lastReorderAt >= REORDER_COOLDOWN_MS)) {
          lastReorderAt = Date.now();
          flipReorderChildren(barsWrap, orderedCols);
          flipReorderChildren(labelsWrap, orderedLbls);
        }
      }

      var waitEl = root.querySelector('#tepa-menti-wait-text');
      if (waitEl) {
        waitEl.textContent = totalVotes === 0
          ? 'Waiting for participants'
          : totalVotes + (totalVotes === 1 ? ' vote received' : ' votes received');
      }
      var countPill = root.querySelector('#tepa-menti-total-pill');
      if (countPill) setAnimatedNum(countPill, totalVotes, function (n) { return String(Math.round(n)); });
      return true;
    }

    function updateQuizQrInPlace(qs, quizWinnersRevealed, totalVotes) {
      var partEl = root.querySelector('#tepa-quiz-stage-participants');
      if (!partEl) return false;
      setAnimatedNum(partEl, Number(qs.total_participants || 0), function (n) { return String(Math.round(n)); });
      var vouchEl = root.querySelector('#tepa-quiz-stage-vouchers');
      if (vouchEl) {
        vouchEl.textContent = quizWinnersRevealed
          ? ((qs.vouchers_awarded || 0) + ' / ' + (qs.max_vouchers || 10))
          : ('Top ' + (qs.max_vouchers || 10));
      }
      var countPill = root.querySelector('#tepa-menti-total-pill');
      if (countPill) setAnimatedNum(countPill, totalVotes, function (n) { return String(Math.round(n)); });
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
        state.hideResults, state.sortMode, mode,
        (activePoll && activePoll.id) || '', (activePoll && activePoll.poll_type) || 'projects',
        (activePoll && activePoll.title) || '',
        projects.length, projectsMetaSig, effHeadline, settings.event_title || '',
        (activeQuiz && activeQuiz.title) || '', (activeQuiz && activeQuiz.voucher_title) || '',
        stageMode === 'quiz_qr'
          ? (quizWinnersRevealedForKey + ':' + (qsForKey.max_vouchers || 10) + ':' + (quizWinnersRevealedForKey ? winnersSig : ''))
          : '',
        stageMode === 'winner_reveal'
          ? ((totalVotes > 0 ? '1' : '0') + ':' + (topWinnerForKey.id || 0))
          : ''
      ].join('|');

      var existingStageEl = root.querySelector('.tepa-menti-stage');
      if (existingStageEl && state.lastRenderKey === renderKey) {
        var liveWorkspaceEl = root.querySelector('.tepa-menti-workspace');
        if (liveWorkspaceEl) liveWorkspaceEl.classList.toggle('is-qr-hidden', !state.showQrSidebar);
        if (stageMode === 'live_voting') {
          var updated = state.chartType === 'horizontal'
            ? updateHorizontalInPlace(ranked, displayList, totalVotes, maxVotes)
            : updateVerticalInPlace(visibleCols, totalVotes, maxVotes);
          if (updated) {
            applyLeaderState(ranked[0] ? ranked[0].id : null, Boolean(ranked[0] && totalVotes > 0 && !state.hideResults && Number(ranked[0].votes) > 0));
            return;
          }
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

      var topOverlay =
        '<img class="tepa-winner-brand-lightup" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">';

      var broadcastFooter =
        '<footer class="tepa-winner-footer">' +
        '  <img class="tepa-winner-footer-logo" src="' + esc(assetUrl('totalenergies-logo.png')) + '" alt="TotalEnergies">' +
        '</footer>';

      var headlineTitle = stageMode === 'quiz_qr'
        ? esc((activeQuiz && activeQuiz.title && activeQuiz.title !== 'Quiz' ? activeQuiz.title : 'Welcome Quiz') + ' — Scan to Join & Win!')
        : (stageMode === 'winner_reveal'
          ? esc(isSimplePoll ? (effHeadline || (activePoll && activePoll.title) || 'Poll Results') : ((settings.event_title || 'TEPA Performance Award 2026') + ' — Best of the Best'))
          : esc(effHeadline || 'Which finalist project deserves the Best of the Best?'));

      var voteHeaderHtml =
        '<div class="tepa-vote-stage-head">' +
        '  <div class="tepa-vote-stage-titles">' +
        '    <h1 class="tepa-menti-headline tepa-vote-stage-title">' + headlineTitle + '</h1>' +
        '  </div>' +
        '</div>';
      var headlineRow = '';

      var workspaceHtml = '';

      if (stageMode === 'quiz_qr') {
        var qs = dash.quiz_stats || { total_participants: 0, vouchers_awarded: 0, max_vouchers: 10, winners: [] };
        var prizeTitle = (activeQuiz && activeQuiz.voucher_title) || 'Café Bonjour Breakfast Voucher';
        var quizWinnersRevealed = Boolean(settings.reveal_quiz_winners || qs.reveal_quiz_winners);
        var quizTitleTxt = (activeQuiz && activeQuiz.title && activeQuiz.title !== 'Quiz') ? activeQuiz.title : 'Welcome Quiz';
        var quizEventTxt = settings.event_title || 'TEPA Performance Award 2026';
        var giftSvg =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>' +
          '<path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';
        var lockSvg =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

        var quizRightHtml;
        if (quizWinnersRevealed) {
          var winnersList = (qs.winners || []);
          var winnersChips = winnersList.map(function (w, i) {
            return (
              '<div class="tepa-quiz-winner q-anim" style="animation-delay:' + (520 + i * 70) + 'ms;">' +
              '  <span class="tepa-quiz-winner-rank">' + esc(w.winner_rank) + '</span>' +
              '  <span class="tepa-quiz-winner-name">' + esc(w.display_name) + '</span>' +
              '  <span class="tepa-quiz-winner-code">····' + esc(w.code_suffix) + '</span>' +
              '</div>'
            );
          }).join('');
          quizRightHtml =
            '<div class="tepa-quiz-section-head q-anim" style="animation-delay:420ms;">' +
            '  <span class="tepa-quiz-section-title">' + giftSvg + '<span>' + esc(prizeTitle) + ' · Official Winners</span></span>' +
            '  <span class="tepa-quiz-badge is-live"><span class="tepa-quiz-dot"></span>Results Live</span>' +
            '</div>' +
            (winnersChips
              ? '<div class="tepa-quiz-winners' + (winnersList.length > 6 ? ' is-dense' : '') + '">' + winnersChips + '</div>'
              : '<div class="tepa-quiz-prize q-anim" style="animation-delay:520ms;"><div class="tepa-quiz-prize-text"><strong>No qualifying winners in this round yet.</strong></div></div>');
        } else {
          quizRightHtml = '';
        }

        workspaceHtml =
          '<div class="tepa-quiz-stage' + (quizWinnersRevealed ? ' is-revealed' : '') + '">' +
          '  <div class="tepa-winner-glow" aria-hidden="true"></div>' +
          '  <div class="tepa-quiz-stage-grid">' +
          '    <div class="tepa-quiz-qr-panel q-anim" style="animation-delay:80ms;">' +
          '      <div class="tepa-quiz-qr-frame"><div class="tepa-menti-qrwrap" id="tepa-stage-quiz-qr"></div></div>' +
          '      <div class="tepa-quiz-qr-cta">Scan to join</div>' +
          '      <div class="tepa-quiz-qr-host">' + esc(shortHostLabel(quizTargetUrl)) + '</div>' +
          '    </div>' +
          '    <div class="tepa-quiz-info">' +
          '      <div class="tepa-winner-eyebrow q-anim" style="animation-delay:180ms;">★ ' + esc(quizEventTxt) + '</div>' +
          '      <h2 class="tepa-quiz-title tepa-rainbow-text q-anim" style="animation-delay:260ms;">' + esc(quizTitleTxt) + '</h2>' +
          '      <p class="tepa-quiz-sub q-anim" style="animation-delay:340ms;">' + (quizWinnersRevealed ? 'Congratulations to the official winners!' : 'Scan the QR code, answer the questions and win!') + '</p>' +
          '      <div class="tepa-quiz-kpis q-anim" style="animation-delay:400ms;">' +
          '        <div class="tepa-quiz-kpi"><strong id="tepa-quiz-stage-participants">' + esc(qs.total_participants || 0) + '</strong><span>Participants</span></div>' +
          '        <div class="tepa-quiz-kpi-sep" aria-hidden="true"></div>' +
          '        <div class="tepa-quiz-kpi"><strong id="tepa-quiz-stage-vouchers" class="is-gold">' + (quizWinnersRevealed ? (esc(qs.vouchers_awarded || 0) + ' / ' + esc(qs.max_vouchers || 10)) : ('Top ' + esc(qs.max_vouchers || 10))) + '</strong><span>' + (quizWinnersRevealed ? 'Winners' : 'Prizes available') + '</span></div>' +
          '      </div>' +
          quizRightHtml +
          '    </div>' +
          '  </div>' +
          '</div>';
      } else if (stageMode === 'winner_reveal') {
        var topWinner = ranked[0];
        var hasWinner = Boolean(topWinner && totalVotes > 0);
        var pctWin = hasWinner ? Math.round((topWinner.votes / totalVotes) * 100) : 0;
        var eventLabel = isSimplePoll
          ? ((activePoll && activePoll.title) || 'Live Poll Results')
          : (settings.event_title || 'TEPA Performance Award 2026');
        var trophySvg =
          '<svg viewBox="924 156 72 78" fill="none" aria-hidden="true">' +
          '<defs>' +
          '<linearGradient id="tepaTrophyStem" x1="954" y1="180" x2="975.041" y2="187.89" gradientUnits="userSpaceOnUse"><stop stop-color="#FFE27A"/><stop offset="0.55" stop-color="#FFD239"/><stop offset="1" stop-color="#F77B39"/></linearGradient>' +
          '<linearGradient id="tepaTrophyHandles" x1="932.094" y1="167.625" x2="943.789" y2="201.811" gradientUnits="userSpaceOnUse"><stop stop-color="#FFE27A"/><stop offset="0.55" stop-color="#FFD239"/><stop offset="1" stop-color="#F77B39"/></linearGradient>' +
          '<linearGradient id="tepaTrophyCup" x1="942.375" y1="159.75" x2="981.758" y2="194.757" gradientUnits="userSpaceOnUse"><stop stop-color="#FFE27A"/><stop offset="0.55" stop-color="#FFD239"/><stop offset="1" stop-color="#F77B39"/></linearGradient>' +
          '<linearGradient id="tepaTrophyBase1" x1="942.375" y1="211.156" x2="947.902" y2="230.107" gradientUnits="userSpaceOnUse"><stop stop-color="#FFE27A"/><stop offset="0.55" stop-color="#FFD239"/><stop offset="1" stop-color="#F77B39"/></linearGradient>' +
          '<linearGradient id="tepaTrophyBase2" x1="937" y1="220" x2="941.071" y2="239.134" gradientUnits="userSpaceOnUse"><stop stop-color="#FFE27A"/><stop offset="0.55" stop-color="#FFD239"/><stop offset="1" stop-color="#F77B39"/></linearGradient>' +
          '</defs>' +
          '<path d="M954 180H966V212H954V180Z" fill="url(#tepaTrophyStem)"/>' +
          '<path d="M942.375 167.625H932.094C932.094 178.641 937.675 185.25 946.047 186.719M977.625 167.625H987.906C987.906 178.641 982.325 185.25 973.953 186.719" stroke="url(#tepaTrophyHandles)" stroke-width="4.7" stroke-linecap="round"/>' +
          '<path d="M942.375 159.75H977.625V180.312C977.625 190.887 969.694 199.406 960 199.406C950.306 199.406 942.375 190.887 942.375 180.312V159.75Z" fill="url(#tepaTrophyCup)"/>' +
          '<path d="M973.953 211.156H946.047C944.019 211.156 942.375 212.8 942.375 214.828V217.766C942.375 219.794 944.019 221.438 946.047 221.438H973.953C975.981 221.438 977.625 219.794 977.625 217.766V214.828C977.625 212.8 975.981 211.156 973.953 211.156Z" fill="url(#tepaTrophyBase1)"/>' +
          '<path d="M980.328 220H940.672C938.644 220 937 221.865 937 224.167V225.833C937 228.135 938.644 230 940.672 230H980.328C982.356 230 984 228.135 984 225.833V224.167C984 221.865 982.356 220 980.328 220Z" fill="url(#tepaTrophyBase2)"/>' +
          '<path opacity="0.88" d="M959.656 170.031L962.006 174.878L967.294 175.612L963.475 179.284L964.356 184.572L959.656 182.075L954.956 184.572L955.838 179.284L952.019 175.612L957.306 174.878L959.656 170.031Z" fill="#FFFFFF"/>' +
          '</svg>';

        workspaceHtml =
          '<div class="tepa-menti-spotlight tepa-winner-stage' + (hasWinner ? '' : ' is-empty') + '">' +
          '  <div class="tepa-winner-glow" aria-hidden="true"></div>' +
          '  <div class="tepa-winner-rays" aria-hidden="true"></div>' +
          (hasWinner
            ? '  <img class="tepa-winner-cone is-left" src="' + esc(assetUrl('confetti-cone.svg')) + '" alt="" aria-hidden="true">' +
              '  <img class="tepa-winner-cone is-right" src="' + esc(assetUrl('confetti-cone.svg')) + '" alt="" aria-hidden="true">'
            : '') +
          '  <div class="tepa-winner-content">' +
          '    <div class="tepa-winner-trophy w-anim w-d1">' + trophySvg + '</div>' +
          '    <div class="tepa-winner-eyebrow w-anim w-d2">★ ' + esc(eventLabel) + '</div>' +
          '    <h2 class="tepa-winner-kicker tepa-rainbow-text w-anim-title w-d3">' + (isSimplePoll ? 'WINNING CHOICE' : 'BEST OF THE BEST') + '</h2>' +
          '    <div class="tepa-winner-divider w-anim-line w-d4" aria-hidden="true"></div>' +
          (hasWinner
            ? ((topWinner.category_name
                ? '<div class="tepa-winner-cat w-anim w-d5">Category ' + esc(pad2(topWinner.slot_number)) + ' · ' + esc(topWinner.category_name) + '</div>'
                : '') +
              '<div class="tepa-winner-name w-anim-name w-d6">' + esc(topWinner.project_title) + '</div>' +
              ((!isSimplePoll && topWinner.team_name)
                ? '<div class="tepa-winner-team w-anim w-d7">' + esc(topWinner.team_name) + '</div>'
                : '') +
              '<div class="tepa-winner-stats w-anim w-d8">' +
              '  <div class="tepa-winner-stat"><strong id="tepa-reveal-votes">' + esc(topWinner.votes) + '</strong><span>votes</span></div>' +
              '  <div class="tepa-winner-stat-sep" aria-hidden="true"></div>' +
              '  <div class="tepa-winner-stat"><strong id="tepa-reveal-pct" class="is-gold">' + pctWin + '%</strong><span>of all votes</span></div>' +
              '</div>')
            : '<div class="tepa-winner-waiting w-anim w-d5">Waiting for votes — the winner will be revealed here.</div>') +
          '  </div>' +
          '</div>';
      } else {
        var chartHtml = '';
        if (state.chartType === 'vertical') {
          var colsCount = visibleCols.length || 5;
          var vColsHtml = visibleCols.map(function (p) {
            var v = Number(p.votes || 0);
            var sharePct = (!state.hideResults && totalVotes > 0) ? Math.round((v / totalVotes) * 100) : 0;
            var barH = (!state.hideResults && maxVotes > 0 && v > 0) ? Math.max(4, (v / maxVotes) * 96) : 3;
            var barHStr = barH.toFixed(2);
            return (
              '<div class="tepa-menti-vcol" data-project-id="' + p.id + '">' +
              '  <div class="tepa-menti-vcount"><span class="tepa-vnum">' + (state.hideResults ? '•' : v) + '</span>' + (state.hideResults ? '' : '<span class="tepa-menti-vcount-pct">' + sharePct + '%</span>') + '</div>' +
              '  <div class="tepa-menti-vbar-wrap">' +
              '    <div class="tepa-menti-vbar" data-target-pct="' + barHStr + '" style="background-color:' + colorFor(p) + ';"></div>' +
              '  </div>' +
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
              '      <span class="tepa-menti-hvotes"><span class="tepa-menti-hpct">' + (state.hideResults ? '••' : (sharePct + '%')) + '</span><span class="tepa-hnum">' + (state.hideResults ? '' : (v + (v === 1 ? ' vote' : ' votes'))) + '</span></span>' +
              '    </div>' +
              '    <div class="tepa-menti-htrack">' +
              '      <div class="tepa-menti-hfill' + (isZero ? ' is-zero' : '') + '" data-target-pct="' + barPctStr + '" style="background-color:' + colorFor(p) + ';"></div>' +
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

        var qrSidebar =
          '<aside class="tepa-menti-sidebar" aria-hidden="' + (state.showQrSidebar ? 'false' : 'true') + '">' +
          '  <div class="tepa-menti-sidebar-inner">' +
          '  <div class="tepa-menti-qrcard">' +
          '    <button type="button" class="tepa-menti-qrclose" data-action="toggle-qr" title="Hide QR">×</button>' +
          '    <div class="tepa-menti-qrwrap" id="tepa-stage-vote-qr"></div>' +
          '    <div class="tepa-menti-qrsub">Scan QR to vote</div>' +
          '    <div class="tepa-menti-qrhost">' + esc(shortHostLabel(voteTargetUrl)) + '</div>' +
          '  </div>' +
          '  <div class="tepa-menti-waitcard" id="tepa-menti-wait-text">' +
          (totalVotes === 0 ? 'Waiting for participants' : totalVotes + (totalVotes === 1 ? ' vote received' : ' votes received')) +
          '  </div>' +
          '  </div>' +
          '</aside>';

        workspaceHtml =
          '<div class="tepa-vote-stage">' +
          '  <div class="tepa-winner-glow" aria-hidden="true"></div>' +
          voteHeaderHtml +
          '  <div class="tepa-menti-workspace' + (state.showQrSidebar ? '' : ' is-qr-hidden') + '">' + chartHtml + qrSidebar + '</div>' +
          '</div>';
      }

      var stageEl = root.querySelector('.tepa-menti-stage');
      var bodyEl = root.querySelector('.tepa-menti-stage-body');
      var onlyThemeSwitch = prevKey && prevKey !== renderKey && prevKey.replace(/\|(light|dark)\|/, '|X|') === renderKey.replace(/\|(light|dark)\|/, '|X|');
      if (stageEl && onlyThemeSwitch) {
        stageEl.setAttribute('data-live-theme', state.theme);
        return;
      }

      var stageSnap = {
        stageMode: stageMode,
        chartType: state.chartType,
        showQrSidebar: state.showQrSidebar,
        quizTargetUrl: quizTargetUrl,
        voteTargetUrl: voteTargetUrl,
        topVotes: ranked[0] ? Number(ranked[0].votes || 0) : 0,
        totalVotes: totalVotes,
        leaderId: ranked[0] ? ranked[0].id : null,
        leaderActive: Boolean(ranked[0] && totalVotes > 0 && !state.hideResults && Number(ranked[0].votes) > 0),
        bodyHtml: headlineRow + workspaceHtml
      };

      function mountStageBody(targetEl, snap) {
        var hostStage = root.querySelector('.tepa-menti-stage');
        if (hostStage) {
          hostStage.setAttribute('data-stage-mode', snap.stageMode);
        }
        if (snap.stageMode !== 'winner_reveal') {
          stopStageConfetti();
        }
        targetEl.innerHTML = snap.bodyHtml;
        if (snap.stageMode === 'quiz_qr') {
          renderQR(targetEl.querySelector('#tepa-stage-quiz-qr'), snap.quizTargetUrl);
        } else if (snap.stageMode === 'live_voting') {
          renderQR(targetEl.querySelector('#tepa-stage-vote-qr'), snap.voteTargetUrl);
          applyLeaderState(snap.leaderId, snap.leaderActive);
          if (snap.chartType === 'horizontal') {
            targetEl.querySelectorAll('.tepa-menti-hfill').forEach(function (el) {
              setAnimatedBar(el, Number(el.getAttribute('data-target-pct') || 0), 'h', el.classList.contains('is-zero'), true);
            });
          } else {
            targetEl.querySelectorAll('.tepa-menti-vbar').forEach(function (el) {
              var colEl = el.closest ? el.closest('.tepa-menti-vcol') : null;
              var cntEl = colEl ? colEl.querySelector('.tepa-menti-vcount') : null;
              setAnimatedBar(el, Number(el.getAttribute('data-target-pct') || 0), 'v', false, true, cntEl);
            });
          }
        } else if (snap.stageMode === 'winner_reveal') {
          if (snap.totalVotes > 0) {
            animateNumber(targetEl.querySelector('#tepa-reveal-votes'), snap.topVotes, function (n) { return String(Math.round(n)); }, 1100, 0);
            animateNumber(targetEl.querySelector('#tepa-reveal-pct'), Math.round((snap.topVotes / snap.totalVotes) * 100), function (n) { return Math.round(n) + '%'; }, 1100, 0);
            launchStageConfetti();
          }
        }
      }

      if (stageEl && bodyEl) {
        stageEl.setAttribute('data-live-theme', state.theme);
        stageEl.setAttribute('data-stage-mode', stageMode);
        var sortToggleBtn = stageEl.querySelector('[data-action="toggle-sort"]');
        if (sortToggleBtn) {
          sortToggleBtn.title = 'Sort: ' + (state.sortMode === 'votes' ? 'Top Votes' : 'Order');
        }
        var topPillEl = stageEl.querySelector('#tepa-menti-total-pill');
        if (topPillEl) setAnimatedNum(topPillEl, totalVotes, function (n) { return String(Math.round(n)); });

        pendingStageMount = stageSnap;
        if (prefersReducedMotion()) {
          if (stageSwapTimer) { clearTimeout(stageSwapTimer); stageSwapTimer = 0; }
          stopStageAnimator();
          bodyEl.classList.remove('is-leaving', 'is-entering');
          mountStageBody(bodyEl, stageSnap);
          pendingStageMount = null;
          return;
        }

        bodyEl.classList.remove('is-entering');
        bodyEl.classList.add('is-leaving');
        if (!stageSwapTimer) {
          stageSwapTimer = setTimeout(function () {
            stageSwapTimer = 0;
            var latestSnap = pendingStageMount;
            pendingStageMount = null;
            var curBody = root.querySelector('.tepa-menti-stage-body');
            if (!curBody || !latestSnap) return;
            stopStageAnimator();
            curBody.classList.remove('is-leaving');
            curBody.classList.add('is-entering');
            mountStageBody(curBody, latestSnap);
            void curBody.offsetHeight;
            if (stageSwapRaf) cancelAnimationFrame(stageSwapRaf);
            stageSwapRaf = requestAnimationFrame(function () {
              stageSwapRaf = 0;
              curBody.classList.remove('is-entering');
            });
          }, 210);
        }
        return;
      }

      if (stageSwapTimer) { clearTimeout(stageSwapTimer); stageSwapTimer = 0; }
      if (stageSwapRaf) { cancelAnimationFrame(stageSwapRaf); stageSwapRaf = 0; }
      pendingStageMount = null;
      stopStageAnimator();
      root.innerHTML =
        '<div class="tepa-menti-stage is-broadcast-stage" data-live-theme="' + esc(state.theme) + '" data-stage-mode="' + esc(stageMode) + '">' +
        '  <div class="tepa-broadcast-canvas">' +
        topOverlay +
        '    <div class="tepa-menti-stage-body' + (prefersReducedMotion() ? '' : ' is-entering') + '"></div>' +
        '  </div>' +
        broadcastFooter +
        '</div>';

      var freshBody = root.querySelector('.tepa-menti-stage-body');
      if (freshBody) {
        mountStageBody(freshBody, stageSnap);
        if (!prefersReducedMotion()) {
          void freshBody.offsetHeight;
          stageSwapRaf = requestAnimationFrame(function () {
            stageSwapRaf = 0;
            freshBody.classList.remove('is-entering');
          });
        }
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
      if (stageSwapTimer) clearTimeout(stageSwapTimer);
      if (stageSwapRaf) cancelAnimationFrame(stageSwapRaf);
      stopStageAnimator();
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

    var AdminI18n = global.TepaAdminI18n || {
      LANGUAGES: [{ code: 'pt', shortLabel: 'PT', label: 'Português' }, { code: 'en', shortLabel: 'EN', label: 'English' }],
      detectInitialLang: function () { return 'en'; },
      saveLang: function (c) { return c === 'pt' ? 'pt' : 'en'; },
      t: function (_, k) { return k; },
      translateDom: function () {}
    };

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
      list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
      globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'
    };

    function icon(name, size) {
      var sz = size || 16;
      var body = SVG_PATHS[name] || SVG_PATHS.sparkles;
      return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
    }

    var state = {
      lang: AdminI18n.detectInitialLang(initCfg),
      pin: savedPin,
      manuallyLocked: false,
      tab: initialTab, // 'stage' | 'livescreen' | 'questions' | 'projects' | 'submissions' | 'settings' | 'audit'
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

    function t(key, vars) {
      return AdminI18n.t(state.lang, key, vars);
    }

    function applyDocumentLang() {
      try {
        if (document.documentElement) {
          document.documentElement.setAttribute('lang', state.lang);
        }
        if (document.body && document.body.classList.contains('tepa-bo-standalone')) {
          document.title = t('docTitle');
        }
      } catch (e) {}
    }

    function buildLangSwitcherHtml() {
      var langs = AdminI18n.LANGUAGES || [
        { code: 'pt', shortLabel: 'PT', label: 'Português' },
        { code: 'en', shortLabel: 'EN', label: 'English' }
      ];
      return (
        '<div class="tepa-bo-lang-switch" role="group" aria-label="' + esc(t('langLabel')) + '" title="' + esc(t('langSwitcherTitle')) + '">' +
        '  <span class="tepa-bo-lang-icon">' + icon('globe', 13) + '</span>' +
        langs.map(function (lg) {
          var isAct = state.lang === lg.code;
          return (
            '<button type="button" class="tepa-bo-lang-btn ' + (isAct ? 'is-active' : '') + '" data-action="set-admin-lang" data-lang="' + esc(lg.code) + '" aria-pressed="' + (isAct ? 'true' : 'false') + '" title="' + esc(lg.label) + '">' +
            esc(lg.shortLabel) +
            '</button>'
          );
        }).join('') +
        '</div>'
      );
    }

    function getSectionMeta(tabKey) {
      var map = {
        stage: { iconName: 'radio', title: t('secStageTitle'), desc: t('secStageDesc') },
        livescreen: { iconName: 'monitor', title: t('secLiveTitle'), desc: t('secLiveDesc') },
        questions: { iconName: 'sparkles', title: t('secQuizTitle'), desc: t('secQuizDesc') },
        projects: { iconName: 'trophy', title: t('secProjectsTitle'), desc: t('secProjectsDesc') },
        submissions: { iconName: 'gift', title: t('secSubmissionsTitle'), desc: t('secSubmissionsDesc') },
        settings: { iconName: 'qr', title: t('secSettingsTitle'), desc: t('secSettingsDesc') },
        audit: { iconName: 'shield', title: t('secAuditTitle'), desc: t('secAuditDesc') }
      };
      return map[tabKey] || map.stage;
    }

    applyDocumentLang();

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
        el.textContent = k.s.voting_open ? t('kpiVotingOpen') : t('kpiVotingClosed');
        el.className = 'tepa-bo-badge ' + (k.s.voting_open ? 'is-green' : 'is-red');
      }
      el = root.querySelector('[data-kpi-votes-sub]');
      if (el) el.textContent = t(k.isSimpleActivePoll ? 'kpiVotesSubOpts' : 'kpiVotesSubProjs', { round: k.s.vote_epoch || 1, count: k.activeProjects.length });

      el = root.querySelector('[data-kpi-leader]');
      if (el) {
        el.textContent = k.leader ? k.leader.project_title : t('kpiNoVotesYet');
        el.title = k.leader ? k.leader.project_title : '';
      }
      el = root.querySelector('[data-kpi-leader-sub]');
      if (el) {
        el.textContent = k.leader
          ? (t('kpiLeaderVotes', { votes: k.leader.votes || 0, pct: k.leaderPct }) + (k.leader.category_name ? (' · ' + k.leader.category_name) : ''))
          : t('kpiWaitingVote');
      }

      el = root.querySelector('[data-kpi-quiz]');
      if (el) animateNumber(el, k.subs.length, function (n) { return String(Math.round(n)); }, 520, initFromZero);
      el = root.querySelector('[data-kpi-quiz-badge]');
      if (el) {
        el.textContent = k.s.quiz_open ? t('kpiQuizOpen') : t('kpiQuizClosed');
        el.className = 'tepa-bo-badge ' + (k.s.quiz_open ? 'is-green' : 'is-red');
      }
      el = root.querySelector('[data-kpi-quiz-sub]');
      if (el) el.textContent = t('kpiQuizSub', { passed: k.passedCount, round: k.s.quiz_epoch || 1 });

      el = root.querySelector('[data-kpi-vouchers]');
      if (el) el.textContent = k.voucherWinners.length + ' / ' + k.maxVouchers;
      el = root.querySelector('[data-kpi-vouchers-badge]');
      if (el) el.textContent = t('kpiFirstN', { max: k.maxVouchers });
      el = root.querySelector('[data-kpi-vouchers-sub]');
      if (el) el.textContent = t('kpiVouchersSub', { count: k.redeemedCount });
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
        ? t(count > 1 ? 'unsavedProjPlural' : 'unsavedProjSingle', { count: count })
        : t(count > 1 ? 'unsavedQPlural' : 'unsavedQSingle', { count: count });
      var discardAct = isProj ? 'discard-projects' : 'discard-questions';
      var saveAct = isProj ? 'save-all-projects' : 'save-all-questions';

      slot.innerHTML =
        '<div class="tepa-bo-floating-save">' +
        '  <div style="display:flex;align-items:center;gap:10px;">' +
        '    <span class="tepa-bo-badge is-gold">' + icon('zap', 12) + ' ' + esc(t('unsavedChanges')) + '</span>' +
        '    <strong style="font-size:13px;">' + esc(label) + '</strong>' +
        '  </div>' +
        '  <div style="display:flex;align-items:center;gap:8px;">' +
        '    <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="' + discardAct + '">' + esc(t('discard')) + '</button>' +
        '    <button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-primary" data-action="' + saveAct + '" ' + (state.saving ? 'disabled' : '') + '>' + icon('check', 13) + ' ' + esc(state.saving ? t('saving') : t('saveAllNow')) + '</button>' +
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

      root.querySelectorAll('[data-tab]').forEach(function (tEl) {
        if (tEl.classList.contains('tepa-bo-nav-item') || tEl.classList.contains('tepa-bo-tab')) {
          tEl.classList.toggle('is-active', tEl.getAttribute('data-tab') === state.tab);
        }
      });

      var meta = getSectionMeta(state.tab);
      var topIcon = root.querySelector('#tepa-bo-topbar-icon');
      if (topIcon) topIcon.innerHTML = icon(meta.iconName, 18);
      var topTitle = root.querySelector('#tepa-bo-topbar-title');
      if (topTitle) topTitle.textContent = meta.title;
      var topDesc = root.querySelector('#tepa-bo-topbar-desc');
      if (topDesc) topDesc.textContent = meta.desc;

      var stBadge = root.querySelector('[data-tab-count="stage"]');
      if (stBadge) {
        stBadge.textContent = s.stage_mode === 'quiz_qr' ? t('badgeStageQuiz') : (s.stage_mode === 'winner_reveal' ? t('badgeStageWinner') : t('badgeStageVoting'));
      }
      var lsBadge = root.querySelector('[data-tab-count="livescreen"]');
      if (lsBadge) {
        lsBadge.textContent = (s.live_theme === 'dark' ? t('themeDark') : t('themeLight')) + ' · ' + (s.stage_mode === 'quiz_qr' ? 'S1' : (s.stage_mode === 'winner_reveal' ? 'S3' : 'S2'));
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
        pBadge.textContent = pCount ? t(pCount > 1 ? 'unsavedEditPlural' : 'unsavedEditSingle', { count: pCount }) : t('allSynced');
        pBadge.className = 'tepa-bo-badge ' + (pCount ? 'is-gold' : 'is-green');
      }
      var pDisc = root.querySelector('[data-action="discard-projects"]');
      if (pDisc) pDisc.style.display = pCount ? '' : 'none';

      var qBadge = root.querySelector('[data-dirty-q-badge]');
      if (qBadge) {
        qBadge.textContent = qCount ? t(qCount > 1 ? 'unsavedEditPlural' : 'unsavedEditSingle', { count: qCount }) : t('allSynced');
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
          state.error = (res && res.error) || t('errInvalidPin');
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
        state.error = (err && err.message) || t('errLoadAdmin');
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
      var header = ['Rank', 'Full Name', 'Email', 'Unique ID', 'Score', 'Total', 'Passed', 'Voucher Winner', 'Voucher Claimed', 'Submitted At'];
      var lines = [header.join(',')];
      rows.forEach(function (r) {
        var cols = [
          r.winner_rank || '',
          '"' + String(r.full_name || '').replace(/"/g, '""') + '"',
          '"' + String(r.email || '').replace(/"/g, '""') + '"',
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
          flash(t('toastCopied', { label: label }));
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
        flash(t('toastPngErr'), true);
      };
      img.src = svgUrl;
    }

    function mountWpSettingsTemplate(containerId) {
      var tpl = document.getElementById('tepa-wp-settings-tpl');
      var mount = root.querySelector('#' + containerId);
      if (tpl && mount) {
        mount.innerHTML = '';
        mount.appendChild(tpl.content.cloneNode(true));
        AdminI18n.translateDom(state.lang, mount);
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
        '      <button type="button" class="tepa-bo-btn" data-action="cancel-confirm-modal">' + esc(t('cancel')) + '</button>' +
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
      var sampleBody = '<p style="color:#94A3B8;font-size:12px;margin-top:40px;">' + esc(t('qzPreviewEmpty')) + '</p>';
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
          '<div style="margin-top:auto;font-size:11px;color:#94A3B8;padding-top:8px;">' + esc(t('qzPreviewShowing', { count: Math.min(Number(qDraft.questions_per_page || 2), previewQs.length) })) + '</div>';
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
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('monitor', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('stScreenTitle')) + '</h2></div>' +
          '        <p class="tepa-bo-card-desc">' + esc(t('stScreenDesc')) + '</p>' +
          '      </div>' +
          '      <a href="' + esc(liveScreenUrl) + '" target="_blank" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-primary">' + icon('external', 13) + '<span>' + esc(t('stLaunchStage')) + '</span></a>' +
          '    </div>' +
          '    <div class="tepa-bo-stage-list">' +
          '      <button type="button" class="tepa-bo-stage-card ' + (s.stage_mode === 'quiz_qr' ? 'is-active' : '') + '" data-action="set-stage" data-val="quiz_qr">' +
          '        <span class="tepa-bo-stage-num">' + icon('qr', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">' + esc(t('stMode1Title')) + '</span>' +
          '          <span class="tepa-bo-stage-desc">' + esc(t('stMode1Desc', { awarded: k.voucherWinners.length, max: k.maxVouchers, revealState: s.reveal_quiz_winners ? t('stWinnersAnnounced') : t('stWinnersHidden') })) + '</span>' +
          '        </span>' +
          (s.stage_mode === 'quiz_qr' ? '<span class="tepa-bo-badge is-green">' + esc(t('stLiveNow')) + '</span>' : '') +
          '      </button>' +
          '      <button type="button" class="tepa-bo-stage-card ' + (s.stage_mode === 'live_voting' ? 'is-active' : '') + '" data-action="set-stage" data-val="live_voting">' +
          '        <span class="tepa-bo-stage-num">' + icon('barChart', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">' + esc(t('stMode2Title')) + '</span>' +
          '          <span class="tepa-bo-stage-desc">' + esc(t('stMode2Desc', { count: k.activeProjects.length })) + '</span>' +
          '        </span>' +
          (s.stage_mode === 'live_voting' ? '<span class="tepa-bo-badge is-green">' + esc(t('stLiveNow')) + '</span>' : '') +
          '      </button>' +
          '      <button type="button" class="tepa-bo-stage-card ' + (s.stage_mode === 'winner_reveal' ? 'is-active' : '') + '" data-action="set-stage" data-val="winner_reveal">' +
          '        <span class="tepa-bo-stage-num">' + icon('trophy', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">' + esc(t('stMode3Title')) + '</span>' +
          '          <span class="tepa-bo-stage-desc">' + esc(t('stMode3Desc')) + '</span>' +
          '        </span>' +
          (s.stage_mode === 'winner_reveal' ? '<span class="tepa-bo-badge is-green">' + esc(t('stLiveNow')) + '</span>' : '') +
          '      </button>' +
          '    </div>' +
          '  </div>' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('sliders', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('stGatesTitle')) + '</h2></div>' +
          '        <p class="tepa-bo-card-desc">' + esc(t('stGatesDesc')) + '</p>' +
          '      </div>' +
          '    </div>' +
          '    <div class="tepa-bo-gate-row">' +
          '      <div>' +
          '        <div class="tepa-bo-stage-title">' + esc(t('stQuizGateTitle')) + '</div>' +
          '        <div class="tepa-bo-stage-desc">' + esc(s.quiz_open ? t('stQuizGateOpen') : t('stQuizGateClosed')) + '</div>' +
          '      </div>' +
          '      <label class="tepa-bo-switch" aria-label="' + esc(t('stQuizGateAria')) + '">' +
          '        <input type="checkbox" class="tepa-bo-switch-input" data-action="toggle-setting" data-key="quiz_open" ' + (s.quiz_open ? 'checked' : '') + '>' +
          '        <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
          '      </label>' +
          '    </div>' +
          '    <div class="tepa-bo-gate-row">' +
          '      <div>' +
          '        <div class="tepa-bo-stage-title">' + esc(t('stRevealQuizTitle')) + '</div>' +
          '        <div class="tepa-bo-stage-desc">' + esc(s.reveal_quiz_winners ? t('stRevealQuizOn') : t('stRevealQuizOff')) + '</div>' +
          '      </div>' +
          '      <label class="tepa-bo-switch" aria-label="' + esc(t('stRevealQuizAria')) + '">' +
          '        <input type="checkbox" class="tepa-bo-switch-input" data-action="toggle-setting" data-key="reveal_quiz_winners" ' + (s.reveal_quiz_winners ? 'checked' : '') + '>' +
          '        <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
          '      </label>' +
          '    </div>' +
          '    <div class="tepa-bo-gate-row">' +
          '      <div>' +
          '        <div class="tepa-bo-stage-title">' + esc(k.isSimpleActivePoll ? t('stVoteGateSimple') : t('stVoteGateProjects')) + '</div>' +
          '        <div class="tepa-bo-stage-desc">' + esc(s.voting_open ? t('stVoteGateOpen') : t('stVoteGateClosed')) + '</div>' +
          '      </div>' +
          '      <label class="tepa-bo-switch" aria-label="' + esc(t('stVoteGateAria')) + '">' +
          '        <input type="checkbox" class="tepa-bo-switch-input" data-action="toggle-setting" data-key="voting_open" ' + (s.voting_open ? 'checked' : '') + '>' +
          '        <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
          '      </label>' +
          '    </div>' +
          '    <form id="tepa-rules-form" style="margin-top:14px;padding-top:14px;border-top:1px solid #E2E8F0;">' +
          '      <div class="tepa-bo-field">' +
          '        <label class="tepa-bo-label" for="tepa-rule-title">' + esc(t('stHeadlineLabel')) + '</label>' +
          '        <input id="tepa-rule-title" class="tepa-bo-input" type="text" maxlength="100" value="' + esc(s.event_title || 'TEPA Performance Award 2026') + '">' +
          '      </div>' +
          '      <div class="tepa-bo-rules-grid">' +
          '        <div>' +
          '          <label class="tepa-bo-label" for="tepa-rule-minscore">' + esc(t('stMinScoreLabel')) + '</label>' +
          '          <input id="tepa-rule-minscore" class="tepa-bo-input" type="number" min="1" max="20" value="' + esc((k.activeQuiz && k.activeQuiz.min_score) || s.min_quiz_score || 5) + '">' +
          '        </div>' +
          '        <div>' +
          '          <label class="tepa-bo-label" for="tepa-rule-maxv">' + esc(t('stMaxVouchersLabel')) + '</label>' +
          '          <input id="tepa-rule-maxv" class="tepa-bo-input" type="number" min="1" max="100" value="' + esc(k.maxVouchers) + '">' +
          '        </div>' +
          '        <div>' +
          '          <button type="submit" class="tepa-bo-btn tepa-bo-btn-dark" style="height:40px;padding:0 18px;">' + icon('check', 14) + '<span>' + esc(t('stSaveRules')) + '</span></button>' +
          '        </div>' +
          '      </div>' +
          '    </form>' +
          '  </div>' +
          '</div>' +
          '<div class="tepa-bo-grid-2">' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('trophy', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('stTop5Title')) + '</h2></div>' +
          '        <p class="tepa-bo-card-desc">' + esc(k.isSimpleActivePoll ? t('stTop5DescOpts') : t('stTop5DescProjs')) + '</p>' +
          '      </div>' +
          '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-tab="projects"><span>' + esc(k.isSimpleActivePoll ? t('stManagePolls') : t('stManageProjects')) + '</span>' + icon('arrowRight', 13) + '</button>' +
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
            : '<p style="color:#64748B;">' + esc(t('stNoActiveOpts')) + '</p>') +
          '    </div>' +
          '  </div>' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('zap', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('stResetTitle')) + '</h2></div>' +
          '        <p class="tepa-bo-card-desc">' + esc(t('stResetDesc')) + '</p>' +
          '      </div>' +
          '    </div>' +
          '    <div class="tepa-bo-sim-box">' +
          '      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:8px;display:flex;align-items:center;gap:6px;">' + icon('zap', 13) + '<span>' + esc(t('stSimHeader')) + '</span></div>' +
          '      <div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '        <button type="button" class="tepa-bo-btn tepa-bo-btn-dark" data-action="simulate-votes" data-count="5">' + icon('plus', 13) + '<span>' + esc(t('stSim5')) + '</span></button>' +
          '        <button type="button" class="tepa-bo-btn" data-action="simulate-votes" data-count="15">' + icon('plus', 13) + '<span>' + esc(t('stSim15')) + '</span></button>' +
          '      </div>' +
          '    </div>' +
          '    <div class="tepa-bo-danger-box">' +
          '      <div style="font-size:11.5px;font-weight:700;color:#991B1B;margin-bottom:8px;display:flex;align-items:center;gap:6px;">' + icon('refresh', 13) + '<span>' + esc(t('stDangerHeader')) + '</span></div>' +
          '      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
          '        <button type="button" class="tepa-bo-btn tepa-bo-btn-danger" data-action="open-confirm-modal" data-modal-kind="reset" data-scope="votes">' + icon('refresh', 13) + '<span>' + esc(t('stResetVotes')) + '</span></button>' +
          '        <button type="button" class="tepa-bo-btn tepa-bo-btn-danger" data-action="open-confirm-modal" data-modal-kind="reset" data-scope="quiz">' + icon('refresh', 13) + '<span>' + esc(t('stResetQuiz')) + '</span></button>' +
          '      </div>' +
          '      <div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '        <button type="button" class="tepa-bo-btn tepa-bo-btn-danger" data-action="open-confirm-modal" data-modal-kind="reset" data-scope="all">' + icon('trash', 13) + '<span>' + esc(t('stResetAll')) + '</span></button>' +
          (mode === 'demo'
            ? '<button type="button" class="tepa-bo-btn" data-action="open-confirm-modal" data-modal-kind="reset" data-scope="seed">' + icon('refresh', 13) + '<span>' + esc(t('stRestoreSeed')) + '</span></button>'
            : '') +
          '      </div>' +
          '      <p class="tepa-bo-hint" style="margin-top:8px;">' + esc(t('stResetHint')) + '</p>' +
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
          quiz_qr: t('lsScene1'),
          live_voting: t('lsScene2'),
          winner_reveal: k.isSimpleActivePoll ? t('lsScene3Simple') : t('lsScene3Projects')
        };
        var monitorHeadline = curStage === 'quiz_qr'
          ? t('lsScanToJoin', { title: (k.activeQuiz && k.activeQuiz.title && k.activeQuiz.title !== 'Quiz') ? k.activeQuiz.title : 'Welcome Quiz' })
          : (curStage === 'winner_reveal'
            ? (k.isSimpleActivePoll ? (vHeadVal || (k.activePoll && k.activePoll.title) || t('lsPollResults')) : (evTitleVal + ' — Best of the Best'))
            : vHeadVal);

        var monitorBodyHtml = '';
        if (curStage === 'quiz_qr') {
          monitorBodyHtml =
            '<div style="display:flex;align-items:center;gap:14px;">' +
            '  <div style="width:56px;height:56px;border-radius:12px;background:' + (curTheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#F1F5F9') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + icon('qr', 26) + '</div>' +
            '  <div style="min-width:0;flex:1;">' +
            '    <div style="font-size:12px;font-weight:700;color:#F77B39;">' + esc(t('lsMonQuizStats', { subs: k.subs.length, awarded: k.voucherWinners.length, max: k.maxVouchers })) + '</div>' +
            '    <div style="font-size:12.5px;margin-top:3px;opacity:0.85;">' +
            esc(curQuizReveal
              ? t('lsMonQuizShowing', { count: k.voucherWinners.length, prize: prizeTitleLs })
              : t('lsMonQuizHidden')) +
            '    </div>' +
            '  </div>' +
            '</div>';
        } else if (curStage === 'winner_reveal') {
          monitorBodyHtml =
            '<div style="padding:10px 14px;border-radius:12px;background:rgba(247,123,57,0.12);border:1px solid rgba(247,123,57,0.3);">' +
            '  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#F77B39;">' + esc(k.isSimpleActivePoll ? t('lsMonLeadSimple') : t('lsMonLeadProjects')) + '</div>' +
            '  <div style="font-size:15px;font-weight:800;margin-top:2px;">' + esc(k.leader ? k.leader.project_title : t('lsMonWaiting')) + '</div>' +
            (k.leader ? '<div style="font-size:12px;opacity:0.8;margin-top:2px;">' + esc(t('kpiLeaderVotes', { votes: k.leader.votes, pct: k.leaderPct }) + (k.leader.category_name ? (' · ' + k.leader.category_name) : '')) + '</div>' : '') +
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
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('monitor', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('lsSwitcherTitle')) + '</h2></div>' +
          '        <p class="tepa-bo-card-desc">' + esc(t('lsSwitcherDesc')) + '</p>' +
          '      </div>' +
          '      <a href="' + esc(liveScreenUrl) + '" target="_blank" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-primary">' + icon('external', 13) + '<span>' + esc(t('lsOpenScreen')) + '</span></a>' +
          '    </div>' +
          '    <div class="tepa-bo-stage-list">' +
          '      <button type="button" class="tepa-bo-stage-card ' + (curStage === 'quiz_qr' ? 'is-active' : '') + '" data-action="set-stage" data-val="quiz_qr">' +
          '        <span class="tepa-bo-stage-num">' + icon('qr', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">' + esc(t('lsScene1')) + '</span>' +
          '          <span class="tepa-bo-stage-desc">' + esc(t('lsScene1Desc', { count: k.subs.length, state: curQuizReveal ? t('lsAnnounced') : t('lsHidden') })) + '</span>' +
          '        </span>' +
          (curStage === 'quiz_qr' ? '<span class="tepa-bo-badge is-green">' + esc(t('lsOnAir')) + '</span>' : '') +
          '      </button>' +
          '      <button type="button" class="tepa-bo-stage-card ' + (curStage === 'live_voting' ? 'is-active' : '') + '" data-action="set-stage" data-val="live_voting">' +
          '        <span class="tepa-bo-stage-num">' + icon('barChart', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">' + esc(t('lsScene2')) + '</span>' +
          '          <span class="tepa-bo-stage-desc">' + esc(t(k.isSimpleActivePoll ? 'lsScene2DescOpts' : 'lsScene2DescProjs', { count: k.activeProjects.length, votes: k.totalVotes })) + '</span>' +
          '        </span>' +
          (curStage === 'live_voting' ? '<span class="tepa-bo-badge is-green">' + esc(t('lsOnAir')) + '</span>' : '') +
          '      </button>' +
          '      <button type="button" class="tepa-bo-stage-card ' + (curStage === 'winner_reveal' ? 'is-active' : '') + '" data-action="set-stage" data-val="winner_reveal">' +
          '        <span class="tepa-bo-stage-num">' + icon('trophy', 15) + '</span>' +
          '        <span class="tepa-bo-stage-meta">' +
          '          <span class="tepa-bo-stage-title">' + esc(k.isSimpleActivePoll ? t('lsScene3Simple') : t('lsScene3Projects')) + '</span>' +
          '          <span class="tepa-bo-stage-desc">' + esc(t('lsScene3Desc', { leader: k.leader ? k.leader.project_title : t('kpiNoVotesYet') })) + '</span>' +
          '        </span>' +
          (curStage === 'winner_reveal' ? '<span class="tepa-bo-badge is-green">' + esc(t('lsOnAir')) + '</span>' : '') +
          '      </button>' +
          '    </div>' +
          '  </div>' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('radio', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('lsMonitorTitle')) + '</h2></div>' +
          '        <p class="tepa-bo-card-desc">' + esc(t('lsMonitorDesc')) + '</p>' +
          '      </div>' +
          '      <span class="tepa-bo-badge is-green">' + esc(t('lsSyncActive')) + '</span>' +
          '    </div>' +
          '    <div class="tepa-bo-monitor-frame is-' + curTheme + '">' +
          '      <div class="tepa-bo-monitor-top">' +
          '        <span class="tepa-bo-monitor-onair"><span class="tepa-bo-status-dot"></span> ' + esc(t('lsOnAirPrefix', { scene: stageNameMap[curStage] || t('secStageTitle') })) + '</span>' +
          '        <span class="tepa-bo-monitor-chip">' + esc(curTheme === 'dark' ? t('lsDarkMode') : t('lsLightMode')) + '</span>' +
          '      </div>' +
          '      <div class="tepa-bo-monitor-body">' +
          '        <div class="tepa-bo-monitor-headline">' + esc(monitorHeadline) + '</div>' +
          monitorBodyHtml +
          '      </div>' +
          '      <div class="tepa-bo-monitor-chips">' +
          '        <span class="tepa-bo-monitor-chip">' + icon('barChart', 11) + '<span>' + esc(t('lsChipChart', { val: curChart === 'vertical' ? t('lsChartColumns', { scope: curScope === 'top5' ? t('lsScopeTop5') : t('lsScopeAll', { count: k.activeProjects.length }) }) : t('lsChartRanked') })) + '</span></span>' +
          '        <span class="tepa-bo-monitor-chip">' + icon('qr', 11) + '<span>' + esc(t('lsChipQr', { val: curShowQr ? t('lsVisible') : t('lsHiddenVal') })) + '</span></span>' +
          '        <span class="tepa-bo-monitor-chip">' + icon(curHideRes ? 'eyeOff' : 'eye', 11) + '<span>' + esc(t('lsChipNumbers', { val: curHideRes ? t('lsSuspense') : t('lsVisible') })) + '</span></span>' +
          '        <span class="tepa-bo-monitor-chip">' + icon('gift', 11) + '<span>' + esc(t('lsChipQuizWin', { val: curQuizReveal ? t('lsLive') : t('lsSecret') })) + '</span></span>' +
          '      </div>' +
          '    </div>' +
          '  </div>' +
          '</div>' +
          '<div class="tepa-bo-grid-2">' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('sliders', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('lsCtrlTitle')) + '</h2></div>' +
          '        <p class="tepa-bo-card-desc">' + esc(t('lsCtrlDesc')) + '</p>' +
          '      </div>' +
          '    </div>' +
          '    <div class="tepa-bo-ctrl-matrix">' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon('sun', 13) + '<span>' + esc(t('lsCtrl1')) + '</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curTheme === 'light' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_theme" data-val="light">' + icon('sun', 12) + '<span>' + esc(t('themeLight')) + '</span></button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curTheme === 'dark' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_theme" data-val="dark">' + icon('moon', 12) + '<span>' + esc(t('themeDark')) + '</span></button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon('barChart', 13) + '<span>' + esc(t('lsCtrl2')) + '</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curChart === 'horizontal' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_chart_type" data-val="horizontal">' + icon('list', 12) + '<span>' + esc(t('lsChartRanked')) + '</span></button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curChart === 'vertical' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_chart_type" data-val="vertical">' + icon('barChart', 12) + '<span>' + esc(t('lsCtrlColumnsBtn')) + '</span></button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon('trophy', 13) + '<span>' + esc(t('lsCtrl3')) + '</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curScope === 'top5' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_vertical_scope" data-val="top5">' + esc(t('lsCtrlTop5Btn')) + '</button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curScope === 'all15' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_vertical_scope" data-val="all15">' + esc(t(k.isSimpleActivePoll ? 'lsCtrlAllOpts' : 'lsCtrlAllProjs', { count: k.activeProjects.length })) + '</button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon('arrowDown', 13) + '<span>' + esc(t('lsCtrl4')) + '</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curSort === 'votes' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_sort_mode" data-val="votes">' + esc(t('lsCtrlByVotes')) + '</button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curSort === 'slot' ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_sort_mode" data-val="slot">' + esc(t('lsCtrlOriginal')) + '</button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon('qr', 13) + '<span>' + esc(t('lsCtrl5')) + '</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curShowQr ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_show_qr" data-val="true">' + esc(t('lsCtrlShowQr')) + '</button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (!curShowQr ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_show_qr" data-val="false">' + esc(t('lsCtrlHideQr')) + '</button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-ctrl-box">' +
          '        <div class="tepa-bo-ctrl-box-lbl">' + icon(curHideRes ? 'eyeOff' : 'eye', 13) + '<span>' + esc(t('lsCtrl6')) + '</span></div>' +
          '        <div class="tepa-bo-seg">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (!curHideRes ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_hide_results" data-val="false">' + esc(t('lsCtrlShowPct')) + '</button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (curHideRes ? 'is-active' : '') + '" data-action="set-live-pref" data-key="live_hide_results" data-val="true">' + esc(t('lsCtrlHideRes')) + '</button>' +
          '        </div>' +
          '      </div>' +
          '    </div>' +
          '  </div>' +
          '  <div class="tepa-bo-card">' +
          '    <div class="tepa-bo-card-head">' +
          '      <div>' +
          '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('gift', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('lsAnnTitle')) + '</h2></div>' +
          '        <p class="tepa-bo-card-desc">' + esc(t('lsAnnDesc')) + '</p>' +
          '      </div>' +
          '    </div>' +
          '    <div class="tepa-bo-reveal-banner ' + (curQuizReveal ? 'is-live' : 'is-hidden') + '" style="margin-bottom:12px;">' +
          '      <div style="min-width:0;flex:1;">' +
          '        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">' +
          '          <strong style="font-size:14px;color:#0F172A;">' + esc(t('lsQuizRevTitle')) + '</strong>' +
          '          <span class="tepa-bo-badge ' + (curQuizReveal ? 'is-green' : 'is-gold') + '">' + esc(curQuizReveal ? t('lsQuizRevLive') : t('lsQuizRevHidden')) + '</span>' +
          '        </div>' +
          '        <div style="font-size:12.5px;color:#475569;">' + esc(t('lsQuizRevReady', { awarded: k.voucherWinners.length, max: k.maxVouchers, prize: prizeTitleLs })) + '</div>' +
          '      </div>' +
          '      <button type="button" class="tepa-bo-btn ' + (curQuizReveal ? 'tepa-bo-btn-dark' : 'tepa-bo-btn-primary') + '" data-action="announce-quiz-winners" data-val="' + (!curQuizReveal) + '">' +
          icon('radio', 14) + '<span>' + esc(curQuizReveal ? t('lsQuizRevHideBtn') : t('lsQuizRevShowBtn')) + '</span></button>' +
          '    </div>' +
          '    <div class="tepa-bo-reveal-banner ' + (curStage === 'winner_reveal' ? 'is-live' : '') + '" style="margin-bottom:16px;">' +
          '      <div style="min-width:0;flex:1;">' +
          '        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">' +
          '          <strong style="font-size:14px;color:#0F172A;">' + esc(k.isSimpleActivePoll ? t('lsPollRevSimple') : t('lsPollRevProjects')) + '</strong>' +
          '          <span class="tepa-bo-badge ' + (curStage === 'winner_reveal' ? 'is-green' : 'is-blue') + '">' + esc(curStage === 'winner_reveal' ? t('lsOnAir') : t('lsStandby')) + '</span>' +
          '        </div>' +
          '        <div style="font-size:12.5px;color:#475569;">' + esc(t('lsCurrentLeader')) + ' <strong>' + esc(k.leader ? k.leader.project_title : t('kpiNoVotesYet')) + '</strong>' + (k.leader ? esc(t('lsCurrentVotesLine', { votes: k.leader.votes, pct: k.leaderPct })) : '') + '</div>' +
          '      </div>' +
          '      <button type="button" class="tepa-bo-btn ' + (curStage === 'winner_reveal' ? 'tepa-bo-btn-dark' : 'tepa-bo-btn-primary') + '" data-action="set-stage" data-val="' + (curStage === 'winner_reveal' ? 'live_voting' : 'winner_reveal') + '">' +
          icon('trophy', 14) + '<span>' + esc(curStage === 'winner_reveal' ? t('lsBackToChart') : (k.isSimpleActivePoll ? t('lsRevealSimple') : t('lsRevealBest'))) + '</span></button>' +
          '    </div>' +
          '    <form id="tepa-live-headlines-form" style="padding-top:12px;border-top:1px solid #E2E8F0;">' +
          '      <div class="tepa-bo-field">' +
          '        <label class="tepa-bo-label" for="tepa-ls-ev-title">' + esc(t('lsFormTitleLbl')) + '</label>' +
          '        <input id="tepa-ls-ev-title" class="tepa-bo-input" type="text" maxlength="100" value="' + esc(evTitleVal) + '">' +
          '      </div>' +
          '      <div class="tepa-bo-rules-grid" style="grid-template-columns:1fr auto;">' +
          '        <div>' +
          '          <label class="tepa-bo-label" for="tepa-ls-v-head">' + esc(t('lsFormHeadLbl')) + '</label>' +
          '          <input id="tepa-ls-v-head" class="tepa-bo-input" type="text" maxlength="160" value="' + esc(vHeadVal) + '">' +
          '        </div>' +
          '        <div>' +
          '          <button type="submit" class="tepa-bo-btn tepa-bo-btn-dark" style="height:40px;padding:0 18px;">' + icon('check', 14) + '<span>' + esc(t('lsUpdateTitlesBtn')) + '</span></button>' +
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
            (isLive ? '<span class="tepa-bo-badge is-green">LIVE</span>' : '<span class="tepa-bo-badge is-muted">' + esc(t('qzDraft')) + '</span>') +
            '  </div>' +
            '  <span style="font-size:11.5px;color:#64748B;">' + esc(t('qzMetaCount', { count: qCnt, unit: qCnt === 1 ? t('qzQuestionSing') : t('qzQuestionPlur'), min: qz.min_score || 5 })) + '</span>' +
            '</button>'
          );
        }).join('') +
        '<button type="button" class="tepa-bo-quiz-pill is-new" data-action="create-quiz">' + icon('plus', 15) + '<span>' + esc(t('qzCreateNew')) + '</span></button>';

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
                    var optLetter = LETTERS[optIdx] || (optIdx + 1);
                    return (
                      '<div class="tepa-bo-opt-row">' +
                      '  <button type="button" class="tepa-bo-opt-radio ' + (isCorrect ? 'is-correct' : '') + '" data-action="set-q-correct-opt" data-id="' + orig.id + '" data-opt-idx="' + optIdx + '" title="' + esc(t('qzMarkCorrect')) + '">' +
                      optLetter +
                      '  </button>' +
                      '  <input class="tepa-bo-input" style="height:36px;min-height:36px;" data-opt-idx="' + optIdx + '" value="' + esc(optText) + '" placeholder="' + esc(t('qzOptPlaceholder', { letter: optLetter })) + '">' +
                      '  <button type="button" class="tepa-bo-icon-btn is-danger" data-action="remove-q-opt" data-id="' + orig.id + '" data-opt-idx="' + optIdx + '" ' + (opts.length <= 2 ? 'disabled' : '') + ' title="' + esc(t('qzRemoveOpt')) + '">' + icon('x', 13) + '</button>' +
                      '</div>'
                    );
                  }).join('') +
                  (opts.length < 4
                    ? '<div><button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="add-q-opt" data-id="' + orig.id + '">' + icon('plus', 12) + '<span>' + esc(t('qzAddOpt')) + '</span></button> <span class="tepa-bo-hint" style="display:inline;margin-left:6px;">' + esc(t('qzHintClickLetter')) + '</span></div>'
                    : '<div class="tepa-bo-hint">' + esc(t('qzHintClickBadge')) + '</div>') +
                  '</div>'
                : '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
                  '  <span class="tepa-bo-label" style="margin:0;">' + esc(t('qzCorrectAnsLbl')) + '</span>' +
                  '  <div class="tepa-bo-seg" style="width:170px;">' +
                  '    <button type="button" class="tepa-bo-seg-btn is-yes ' + (isTrue ? 'is-active' : '') + '" data-action="set-q-ans" data-id="' + orig.id + '" data-val="true">' + esc(t('qzYes')) + '</button>' +
                  '    <button type="button" class="tepa-bo-seg-btn is-no ' + (!isTrue ? 'is-active' : '') + '" data-action="set-q-ans" data-id="' + orig.id + '" data-val="false">' + esc(t('qzNo')) + '</button>' +
                  '  </div>' +
                  '</div>';

              return (
                '<div class="tepa-bo-q-card ' + (isDirty ? 'is-dirty' : '') + '" data-q-row="' + orig.id + '">' +
                '  <div class="tepa-bo-q-card-top">' +
                '    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                '      <span class="tepa-bo-slot-pill" style="background:#2194D4;">Q' + pad2(idx + 1) + '</span>' +
                '      <button type="button" class="tepa-bo-icon-btn" data-action="move-question" data-id="' + orig.id + '" data-dir="-1" ' + (idx === 0 ? 'disabled' : '') + ' title="' + esc(t('qzMoveUp')) + '">' + icon('arrowUp', 13) + '</button>' +
                '      <button type="button" class="tepa-bo-icon-btn" data-action="move-question" data-id="' + orig.id + '" data-dir="1" ' + (idx === selQs.length - 1 ? 'disabled' : '') + ' title="' + esc(t('qzMoveDown')) + '">' + icon('arrowDown', 13) + '</button>' +
                '      <div class="tepa-bo-seg">' +
                '        <button type="button" class="tepa-bo-seg-btn ' + (!isMc ? 'is-active' : '') + '" data-action="set-q-type" data-id="' + orig.id + '" data-qtype="yes_no">' + esc(t('qzYesNo')) + '</button>' +
                '        <button type="button" class="tepa-bo-seg-btn ' + (isMc ? 'is-active' : '') + '" data-action="set-q-type" data-id="' + orig.id + '" data-qtype="multiple_choice">' + esc(t('qzMultipleChoice')) + '</button>' +
                '      </div>' +
                '    </div>' +
                '    <div style="display:flex;align-items:center;gap:8px;">' +
                '      <label class="tepa-bo-switch is-sm" title="' + esc(t('qzIncludeToggle')) + '">' +
                '        <input type="checkbox" class="tepa-bo-switch-input" data-field="is_active" ' + (q.is_active !== false ? 'checked' : '') + '>' +
                '        <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
                '      </label>' +
                '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm ' + (isDirty ? 'tepa-bo-btn-dark' : '') + '" data-action="save-question" data-id="' + orig.id + '">' + icon('check', 12) + '<span>' + esc(t('qzSave')) + '</span></button>' +
                '      <button type="button" class="tepa-bo-icon-btn is-danger" data-action="open-confirm-modal" data-modal-kind="archive_question" data-id="' + orig.id + '" title="' + esc(t('qzDeleteQ')) + '">' + icon('trash', 13) + '</button>' +
                '    </div>' +
                '  </div>' +
                '  <div class="tepa-bo-q-body">' +
                '    <input class="tepa-bo-input" data-field="question_text" value="' + esc(q.question_text) + '" placeholder="' + esc(t('qzQPlaceholder')) + '">' +
                answerBuilder +
                '  </div>' +
                '</div>'
              );
            }).join('')
          : '<div style="padding:24px;text-align:center;color:#64748B;border:1px dashed #CBD5E1;border-radius:12px;">' + esc(t('qzEmpty')) + '</div>';

        return (
          '<div class="tepa-bo-quiz-pills">' + pillsHtml + '</div>' +
          '<div class="tepa-bo-studio-layout">' +
          '  <div style="display:flex;flex-direction:column;gap:16px;min-width:0;">' +
          (qDraft
            ? '<div class="tepa-bo-card">' +
              '  <div class="tepa-bo-card-head">' +
              '    <div>' +
              '      <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('sliders', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('qzSetupTitle')) + '</h2></div>' +
              '      <p class="tepa-bo-card-desc">' + esc(t('qzSetupDesc')) + '</p>' +
              '    </div>' +
              '    <div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              (!isLiveQuiz
                ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-primary" data-action="activate-quiz" data-id="' + esc(qDraft.id) + '" data-reset="false">' + icon('radio', 13) + '<span>' + esc(t('qzSetLive')) + '</span></button>' +
                  '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-dark" data-action="activate-quiz" data-id="' + esc(qDraft.id) + '" data-reset="true">' + icon('refresh', 13) + '<span>' + esc(t('qzSetLiveReset')) + '</span></button>'
                : '<span class="tepa-bo-badge is-green" style="height:31px;padding:0 12px;">' + esc(t('qzCurrentlyLive')) + '</span>') +
              '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="duplicate-quiz" data-id="' + esc(qDraft.id) + '">' + icon('copy', 12) + '<span>' + esc(t('qzDuplicate')) + '</span></button>' +
              (quizzes.length > 1
                ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-danger" data-action="open-confirm-modal" data-modal-kind="archive_quiz" data-id="' + esc(qDraft.id) + '">' + icon('trash', 12) + '<span>' + esc(t('qzDelete')) + '</span></button>'
                : '') +
              '    </div>' +
              '  </div>' +
              '  <form id="tepa-quiz-meta-form" data-quiz-id="' + esc(qDraft.id) + '">' +
              '    <div class="tepa-bo-form-row" style="margin-bottom:12px;">' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-qm-title">' + esc(t('qzTitleLbl')) + '</label>' +
              '        <input id="tepa-qm-title" class="tepa-bo-input" data-qmeta="title" type="text" maxlength="80" value="' + esc(qDraft.title) + '" required>' +
              '      </div>' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-qm-qpp">' + esc(t('qzQppLbl')) + '</label>' +
              '        <select id="tepa-qm-qpp" class="tepa-bo-select" data-qmeta="questions_per_page">' +
              [1, 2, 4, 6, 10].map(function (n) {
                var sel = Number(qDraft.questions_per_page || 2) === n ? 'selected' : '';
                return '<option value="' + n + '" ' + sel + '>' + esc(n === 10 ? t('qzQppAll') : t('qzQppPer', { n: n })) + '</option>';
              }).join('') +
              '        </select>' +
              '      </div>' +
              '    </div>' +
              '    <div class="tepa-bo-field">' +
              '      <label class="tepa-bo-label" for="tepa-qm-sub">' + esc(t('qzCoverSubLbl')) + '</label>' +
              '      <input id="tepa-qm-sub" class="tepa-bo-input" data-qmeta="subtitle" type="text" maxlength="220" value="' + esc(qDraft.subtitle || '') + '">' +
              '    </div>' +
              '    <div class="tepa-bo-gate-row" style="margin-bottom:12px;">' +
              '      <div>' +
              '        <div class="tepa-bo-stage-title">' + esc(t('qzEnableVoucherTitle')) + '</div>' +
              '        <div class="tepa-bo-stage-desc">' + esc(t('qzEnableVoucherDesc')) + '</div>' +
              '      </div>' +
              '      <label class="tepa-bo-switch">' +
              '        <input type="checkbox" class="tepa-bo-switch-input" data-qmeta="voucher_enabled" ' + (qDraft.voucher_enabled !== false ? 'checked' : '') + '>' +
              '        <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
              '      </label>' +
              '    </div>' +
              '    <div class="tepa-bo-form-row">' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-qm-vtitle">' + esc(t('qzVoucherTitleLbl')) + '</label>' +
              '        <input id="tepa-qm-vtitle" class="tepa-bo-input" data-qmeta="voucher_title" type="text" value="' + esc(qDraft.voucher_title || 'Café Bonjour Breakfast Voucher') + '">' +
              '      </div>' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-qm-min">' + esc(t('qzMinScoreLbl')) + '</label>' +
              '        <input id="tepa-qm-min" class="tepa-bo-input" data-qmeta="min_score" type="number" min="1" max="50" value="' + esc(qDraft.min_score || 5) + '">' +
              '      </div>' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-qm-maxv">' + esc(t('qzMaxWinnersLbl')) + '</label>' +
              '        <input id="tepa-qm-maxv" class="tepa-bo-input" data-qmeta="max_vouchers" type="number" min="1" max="200" value="' + esc(qDraft.max_vouchers || 10) + '">' +
              '      </div>' +
              '      <div>' +
              '        <button type="submit" class="tepa-bo-btn tepa-bo-btn-dark" style="width:100%;height:40px;">' + icon('check', 14) + '<span>' + esc(t('qzSaveSettings')) + '</span></button>' +
              '      </div>' +
              '    </div>' +
              '  </form>' +
              '</div>'
            : '') +
          '    <div class="tepa-bo-card">' +
          '      <div class="tepa-bo-toolbar">' +
          '        <div>' +
          '          <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('sparkles', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('qzQuestionsTitle', { count: selQs.length })) + '</h2></div>' +
          '          <p class="tepa-bo-card-desc">' + esc(t('qzQuestionsDesc')) + '</p>' +
          '        </div>' +
          '        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '          <span data-dirty-q-badge class="tepa-bo-badge ' + (dirtyQCount ? 'is-gold' : 'is-green') + '">' + esc(dirtyQCount ? t(dirtyQCount > 1 ? 'unsavedEditPlural' : 'unsavedEditSingle', { count: dirtyQCount }) : t('allSynced')) + '</span>' +
          '          <button type="button" class="tepa-bo-btn" data-action="discard-questions" style="' + (dirtyQCount ? '' : 'display:none;') + '">' + esc(t('discard')) + '</button>' +
          '          <button type="button" class="tepa-bo-btn" data-action="create-question" data-qtype="yes_no">' + icon('plus', 13) + '<span>' + esc(t('qzYesNo')) + '</span></button>' +
          '          <button type="button" class="tepa-bo-btn" data-action="create-question" data-qtype="multiple_choice">' + icon('plus', 13) + '<span>' + esc(t('qzMultipleChoice')) + '</span></button>' +
          '          <button type="button" class="tepa-bo-btn tepa-bo-btn-primary" data-action="save-all-questions" ' + (state.saving ? 'disabled' : '') + '>' + icon('check', 14) + '<span>' + esc(t('qzSaveAll')) + '</span></button>' +
          '        </div>' +
          '      </div>' +
          '      <div class="tepa-bo-q-list">' + qCardsHtml + '</div>' +
          '    </div>' +
          '  </div>' +
          '  <aside class="tepa-bo-phone-sticky">' +
          '    <div class="tepa-bo-card">' +
          '      <div class="tepa-bo-card-head" style="margin-bottom:10px;">' +
          '        <div>' +
          '          <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('smartphone', 14) + '</span><h3 class="tepa-bo-card-title" style="font-size:14.5px;">' + esc(t('qzPreviewTitle')) + '</h3></div>' +
          '          <p class="tepa-bo-card-desc">' + esc(t('qzPreviewDesc')) + '</p>' +
          '        </div>' +
          '        <div class="tepa-bo-seg" style="width:154px;">' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (state.previewScreen === 'cover' ? 'is-active' : '') + '" data-preview-mode="cover">' + esc(t('qzPreviewCover')) + '</button>' +
          '          <button type="button" class="tepa-bo-seg-btn ' + (state.previewScreen === 'questions' ? 'is-active' : '') + '" data-preview-mode="questions">' + esc(t('qzPreviewQuestion')) + '</button>' +
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
          var fmtLbl = pl.poll_type === 'simple' ? t('plSimpleFmt') : t('plProjectsFmt');
          var unitLbl = pl.poll_type === 'simple'
            ? (optCnt === 1 ? t('plOptSing') : t('plOptPlur'))
            : (optCnt === 1 ? t('plProjSing') : t('plProjPlur'));
          return (
            '<button type="button" class="tepa-bo-quiz-pill ' + (isSel ? 'is-active' : '') + '" data-action="select-poll" data-id="' + esc(pl.id) + '">' +
            '  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;">' +
            '    <strong style="font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(pl.title) + '</strong>' +
            (isLive ? '<span class="tepa-bo-badge is-green">LIVE</span>' : '<span class="tepa-bo-badge is-muted">' + esc(t('qzDraft')) + '</span>') +
            '  </div>' +
            '  <span style="font-size:11.5px;color:#64748B;">' + esc(optCnt + ' ' + unitLbl + ' · ' + fmtLbl) + '</span>' +
            '</button>'
          );
        }).join('') +
        '<button type="button" class="tepa-bo-quiz-pill is-new" data-action="create-poll" data-polltype="simple">' + icon('plus', 15) + '<span>' + esc(t('plCreateNew')) + '</span></button>';

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
            '    <button type="button" class="tepa-bo-icon-btn" data-action="move-project" data-id="' + orig.id + '" data-dir="-1" ' + (idx === 0 ? 'disabled' : '') + ' title="' + esc(t('qzMoveUp')) + '">' + icon('arrowUp', 13) + '</button>' +
            '    <button type="button" class="tepa-bo-icon-btn" data-action="move-project" data-id="' + orig.id + '" data-dir="1" ' + (idx === filteredProjects.length - 1 ? 'disabled' : '') + ' title="' + esc(t('qzMoveDown')) + '">' + icon('arrowDown', 13) + '</button>' +
            '  </div>' +
            (isSimple ? '' : '  <input class="tepa-bo-input" data-field="category_name" value="' + esc(p.category_name || '') + '" placeholder="' + esc(t('plPhCategory')) + '">') +
            '  <input class="tepa-bo-input" data-field="project_title" value="' + esc(p.project_title) + '" placeholder="' + esc(isSimple ? t('plPhOptLabel') : t('plPhTitle')) + '">' +
            (isSimple ? '' : '  <input class="tepa-bo-input" data-field="team_name" value="' + esc(p.team_name || '') + '" placeholder="' + esc(t('plPhTeam')) + '">') +
            '  <div class="tepa-bo-votes-col">' +
            '    <div class="tepa-bo-votes-pill">' + v + ' <span style="color:#64748B;font-weight:500;">(' + esc(isAct ? (pct + '%') : t('lsHiddenVal')) + ')</span></div>' +
            '    <div class="tepa-bo-proj-bar-track"><div class="tepa-bo-proj-bar-fill" data-target-pct="' + Math.max(v > 0 && isAct ? 4 : 0, pct) + '" style="width:' + pct + '%;"></div></div>' +
            '  </div>' +
            '  <label class="tepa-bo-switch is-sm" title="' + esc(t('plShowOnVoting')) + '">' +
            '    <input type="checkbox" class="tepa-bo-switch-input" data-field="is_active" ' + (isAct ? 'checked' : '') + '>' +
            '    <span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>' +
            '  </label>' +
            '  <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;">' +
            '    <button type="button" class="tepa-bo-btn tepa-bo-btn-sm ' + (isDirty ? 'tepa-bo-btn-dark' : '') + '" data-action="save-project" data-id="' + orig.id + '">' + icon('check', 12) + '<span>' + esc(t('qzSave')) + '</span></button>' +
            '    <button type="button" class="tepa-bo-icon-btn is-danger" data-action="open-confirm-modal" data-modal-kind="archive_project" data-id="' + orig.id + '" title="' + esc(t('plRemoveOption')) + '">' + icon('trash', 13) + '</button>' +
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
              '      <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('sliders', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('plSetupTitle')) + '</h2></div>' +
              '      <p class="tepa-bo-card-desc">' + esc(t('plSetupDesc')) + '</p>' +
              '    </div>' +
              '    <div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              (!isLivePoll
                ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-primary" data-action="activate-poll" data-id="' + esc(pDraft.id) + '" data-reset="false">' + icon('radio', 13) + '<span>' + esc(t('qzSetLive')) + '</span></button>' +
                  '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-dark" data-action="activate-poll" data-id="' + esc(pDraft.id) + '" data-reset="true">' + icon('refresh', 13) + '<span>' + esc(t('qzSetLiveReset')) + '</span></button>'
                : '<span class="tepa-bo-badge is-green" style="height:31px;padding:0 12px;">' + esc(t('plCurrentlyLive')) + '</span>') +
              '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="duplicate-poll" data-id="' + esc(pDraft.id) + '">' + icon('copy', 12) + '<span>' + esc(t('qzDuplicate')) + '</span></button>' +
              (polls.length > 1
                ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-danger" data-action="open-confirm-modal" data-modal-kind="archive_poll" data-id="' + esc(pDraft.id) + '">' + icon('trash', 12) + '<span>' + esc(t('qzDelete')) + '</span></button>'
                : '') +
              '    </div>' +
              '  </div>' +
              '  <form id="tepa-poll-meta-form" data-poll-id="' + esc(pDraft.id) + '">' +
              '    <div class="tepa-bo-form-row" style="margin-bottom:12px;">' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-pm-title">' + esc(t('plNameLbl')) + '</label>' +
              '        <input id="tepa-pm-title" class="tepa-bo-input" data-pmeta="title" type="text" maxlength="100" value="' + esc(pDraft.title || '') + '" required>' +
              '      </div>' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-pm-type">' + esc(t('plTypeLbl')) + '</label>' +
              '        <select id="tepa-pm-type" class="tepa-bo-select" data-pmeta="poll_type">' +
              '          <option value="simple" ' + (isSimple ? 'selected' : '') + '>' + esc(t('plTypeSimple')) + '</option>' +
              '          <option value="projects" ' + (!isSimple ? 'selected' : '') + '>' + esc(t('plTypeProjects')) + '</option>' +
              '        </select>' +
              '      </div>' +
              '    </div>' +
              '    <div class="tepa-bo-form-row">' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-pm-head">' + esc(t('plHeadLbl')) + '</label>' +
              '        <input id="tepa-pm-head" class="tepa-bo-input" data-pmeta="voting_headline" type="text" maxlength="160" value="' + esc(pDraft.voting_headline || '') + '">' +
              '      </div>' +
              '      <div>' +
              '        <label class="tepa-bo-label" for="tepa-pm-sub">' + esc(t('plSubLbl')) + '</label>' +
              '        <input id="tepa-pm-sub" class="tepa-bo-input" data-pmeta="voting_subtitle" type="text" maxlength="180" value="' + esc(pDraft.voting_subtitle || '') + '">' +
              '      </div>' +
              '      <div>' +
              '        <button type="submit" class="tepa-bo-btn tepa-bo-btn-dark" style="width:100%;height:40px;white-space:nowrap;">' + icon('check', 14) + '<span>' + esc(t('plSaveSettings')) + '</span></button>' +
              '      </div>' +
              '    </div>' +
              '  </form>' +
              '</div>'
            : '') +
          '<div class="tepa-bo-card">' +
          '  <div class="tepa-bo-toolbar">' +
          '    <div>' +
          '      <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('trophy', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t(isSimple ? 'plListTitleSimple' : 'plListTitleProjs', { count: pollProjects.length })) + '</h2></div>' +
          '      <p class="tepa-bo-card-desc">' + esc(t('plListDesc', { active: activeCnt, hidden: hiddenCnt })) + '</p>' +
          '    </div>' +
          '    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '      <span data-dirty-proj-badge class="tepa-bo-badge ' + (dirtyProjCount ? 'is-gold' : 'is-green') + '">' + esc(dirtyProjCount ? t(dirtyProjCount > 1 ? 'unsavedEditPlural' : 'unsavedEditSingle', { count: dirtyProjCount }) : t('allSynced')) + '</span>' +
          '      <button type="button" class="tepa-bo-btn" data-action="discard-projects" style="' + (dirtyProjCount ? '' : 'display:none;') + '">' + esc(t('discard')) + '</button>' +
          (hiddenCnt > 0 ? '<button type="button" class="tepa-bo-btn" data-action="enable-all-projects">' + icon('check', 13) + '<span>' + esc(t('plEnableAll', { count: pollProjects.length })) + '</span></button>' : '') +
          '      <button type="button" class="tepa-bo-btn" data-action="create-project">' + icon('plus', 13) + '<span>' + esc(isSimple ? t('plAddOpt') : t('plAddProj')) + '</span></button>' +
          '      <button type="button" class="tepa-bo-btn tepa-bo-btn-primary" data-action="save-all-projects" ' + (state.saving ? 'disabled' : '') + '>' + icon('check', 14) + '<span>' + esc(isSimple ? t('plSaveAllOpts') : t('plSaveAllProjs')) + '</span></button>' +
          '    </div>' +
          '  </div>' +
          '  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;">' +
          '    <div class="tepa-bo-filter-pills">' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.projFilter === 'all' ? 'is-active' : '') + '" data-projfilter="all">' + esc(t('plFilterAll', { count: pollProjects.length })) + '</button>' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.projFilter === 'active' ? 'is-active' : '') + '" data-projfilter="active">' + esc(t('plFilterActive', { count: activeCnt })) + '</button>' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.projFilter === 'hidden' ? 'is-active' : '') + '" data-projfilter="hidden">' + esc(t('plFilterHidden', { count: hiddenCnt })) + '</button>' +
          '    </div>' +
          '    <input id="tepa-proj-search" class="tepa-bo-input" style="width:240px;height:34px;min-height:34px;" type="search" placeholder="' + esc(isSimple ? t('plSearchSimple') : t('plSearchProjs')) + '" value="' + esc(state.projSearch) + '">' +
          '  </div>' +
          '  <div class="tepa-bo-proj-head' + (isSimple ? ' is-simple' : '') + '">' +
          (isSimple
            ? '    <span>' + esc(t('plColOrder')) + '</span><span>' + esc(t('plColOptLabel')) + '</span><span style="text-align:right;">' + esc(t('plColVotes')) + '</span><span>' + esc(t('plColActive')) + '</span><span style="text-align:right;">' + esc(t('plColActions')) + '</span>'
            : '    <span>' + esc(t('plColOrder')) + '</span><span>' + esc(t('plColCategory')) + '</span><span>' + esc(t('plColTitle')) + '</span><span>' + esc(t('plColTeam')) + '</span><span style="text-align:right;">' + esc(t('plColVotes')) + '</span><span>' + esc(t('plColActive')) + '</span><span style="text-align:right;">' + esc(t('plColActions')) + '</span>') +
          '  </div>' +
          '  <div class="tepa-bo-proj-list">' + (projRows || '<p style="text-align:center;padding:24px;color:#64748B;">' + esc(t('plNoMatch')) + '</p>') + '</div>' +
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
            String(row.email || '').toLowerCase().indexOf(needle) !== -1 ||
            String(row.unique_code || '').toLowerCase().indexOf(needle) !== -1
          );
        });

        return (
          '<div class="tepa-bo-card">' +
          '  <div class="tepa-bo-toolbar">' +
          '    <div class="tepa-bo-filter-pills">' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.subFilter === 'all' ? 'is-active' : '') + '" data-subfilter="all">' + esc(t('subFilterAll', { count: subs.length })) + '</button>' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.subFilter === 'winners' ? 'is-active' : '') + '" data-subfilter="winners">' + esc(t('subFilterWinners', { max: k.maxVouchers, count: winSubs.length })) + '</button>' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.subFilter === 'pending' ? 'is-active' : '') + '" data-subfilter="pending">' + esc(t('subFilterPending', { count: pendingSubs.length })) + '</button>' +
          '      <button type="button" class="tepa-bo-filter-pill ' + (state.subFilter === 'redeemed' ? 'is-active' : '') + '" data-subfilter="redeemed">' + esc(t('subFilterRedeemed', { count: redeemedSubs.length })) + '</button>' +
          '    </div>' +
          '    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '      <input id="tepa-admin-search" class="tepa-bo-input" style="width:230px;" type="search" placeholder="' + esc(t('subSearchPh')) + '" value="' + esc(state.search) + '">' +
          '      <button type="button" class="tepa-bo-btn ' + (s.reveal_quiz_winners ? 'tepa-bo-btn-success' : 'tepa-bo-btn-primary') + '" data-action="announce-quiz-winners" data-val="' + (!s.reveal_quiz_winners) + '">' +
          icon('radio', 14) + '<span>' + esc(s.reveal_quiz_winners ? t('subAnnounceHide') : t('subAnnounceShow')) + '</span></button>' +
          '      <button type="button" class="tepa-bo-btn tepa-bo-btn-dark" data-action="export-csv">' + icon('download', 14) + '<span>' + esc(t('subExportCsv')) + '</span></button>' +
          '    </div>' +
          '  </div>' +
          '  <div class="tepa-bo-table-wrap"><table class="tepa-bo-table">' +
          '    <thead><tr><th>' + esc(t('subColRank')) + '</th><th>' + esc(t('subColName')) + '</th><th>' + esc(t('subColCode')) + '</th><th>' + esc(t('subColScore')) + '</th><th>' + esc(t('subColStatus')) + '</th><th>' + esc(t('subColTime')) + '</th><th>' + esc(t('subColDesk')) + '</th></tr></thead>' +
          '    <tbody>' +
          (filteredSubs.length
            ? filteredSubs.map(function (r) {
                return (
                  '<tr>' +
                  '  <td>' + (r.winner_rank ? '<span class="tepa-bo-badge is-gold">#' + r.winner_rank + '</span>' : '<span style="color:#94A3B8;">—</span>') + '</td>' +
                  '  <td><strong>' + esc(r.full_name) + '</strong>' + (r.email ? '<div style="font-size:11.5px;color:#64748B;margin-top:2px;">' + esc(r.email) + '</div>' : '') + '</td>' +
                  '  <td><button type="button" class="tepa-bo-code-btn" data-action="copy-text" data-text="' + esc(r.unique_code) + '" data-label="' + esc(t('subCopyCodeLabel')) + '" title="' + esc(t('subCopyCodeTitle')) + '">' + icon('copy', 11) + ' ' + esc(r.unique_code) + '</button></td>' +
                  '  <td><span class="tepa-bo-badge ' + (r.passed_criteria ? 'is-green' : 'is-muted') + '">' + esc(r.score) + ' / ' + esc(r.total_questions) + '</span></td>' +
                  '  <td>' + (r.is_voucher_winner
                    ? '<span class="tepa-bo-badge is-gold">' + esc(t('subStatusWinner')) + '</span>'
                    : (r.passed_criteria ? '<span class="tepa-bo-badge is-blue">' + esc(t('subStatusPassed')) + '</span>' : '<span class="tepa-bo-badge is-muted">' + esc(t('subStatusParticipant')) + '</span>')) + '</td>' +
                  '  <td style="color:#64748B;">' + esc(formatTime(r.created_at)) + '</td>' +
                  '  <td>' + (r.is_voucher_winner
                    ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm ' + (r.voucher_claimed ? 'tepa-bo-btn-success' : 'tepa-bo-btn-dark') + '" data-action="toggle-claim" data-id="' + esc(r.id) + '" data-val="' + (!r.voucher_claimed) + '">' + (r.voucher_claimed ? (icon('check', 12) + '<span>' + esc(t('subRedeemed')) + '</span>') : esc(t('subMarkRedeemed'))) + '</button>'
                    : '<span style="color:#94A3B8;">—</span>') + '</td>' +
                  '</tr>'
                );
              }).join('')
            : '<tr><td colspan="7" style="text-align:center;padding:28px;color:#64748B;">' + esc(t('subEmpty')) + '</td></tr>') +
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
            title: t('aud1Title'),
            desc: t('aud1Desc'),
            badge: t('aud1Badge'),
            actionTab: 'settings',
            actionLbl: t('aud1Action')
          },
          {
            ok: true,
            title: t('aud2Title', { mode: mode === 'supabase' ? t('aud2ModeProd') : t('aud2ModeDemo') }),
            desc: mode === 'supabase' ? t('aud2DescProd') : t('aud2DescDemo'),
            badge: mode === 'supabase' ? t('aud2BadgeProd') : t('aud2BadgeDemo'),
            actionTab: 'settings',
            actionLbl: t('aud2Action')
          },
          {
            ok: Boolean(actQuiz && actQuizQs.length > 0 && minScoreOk),
            title: t('aud3Title', { title: actQuiz ? actQuiz.title : t('aud3None') }),
            desc: actQuiz
              ? t('aud3Desc', { count: actQuizQs.length, min: actQuiz.min_score || 1, qpp: actQuiz.questions_per_page || 2 })
              : t('aud3NoQuiz'),
            badge: (actQuiz && actQuizQs.length > 0) ? t('aud3Ready') : t('aud3Check'),
            actionTab: 'questions',
            actionLbl: t('aud3Action')
          },
          {
            ok: Boolean(activeProjs.length >= 2),
            title: t('aud4Title', { title: k.activePoll ? k.activePoll.title : t('aud4Default'), count: activeProjs.length }),
            desc: t(k.isSimpleActivePoll ? 'aud4DescOpts' : 'aud4DescProjs', { active: activeProjs.length, total: k.pollProjects.length, votes: k.totalVotes }),
            badge: t('aud4Badge', { count: activeProjs.length }),
            actionTab: 'projects',
            actionLbl: t('aud4Action')
          },
          {
            ok: Boolean(s.quiz_open && s.voting_open),
            title: t('aud5Title'),
            desc: t('aud5Desc', { quizState: s.quiz_open ? t('aud5Open') : t('aud5Closed'), voteState: s.voting_open ? t('aud5Open') : t('aud5Closed') }),
            badge: (s.quiz_open && s.voting_open) ? t('aud5Open') : t('aud5Paused'),
            actionTab: 'stage',
            actionLbl: t('aud5Action')
          },
          {
            ok: true,
            title: t('aud6Title', { awarded: k.voucherWinners.length, max: k.maxVouchers }),
            desc: t('aud6Desc', { state: s.reveal_quiz_winners ? t('aud6StateOn') : t('aud6StateOff') }),
            badge: s.reveal_quiz_winners ? t('aud6BadgeOn') : t('aud6BadgeOff'),
            actionTab: 'submissions',
            actionLbl: t('aud6Action')
          },
          {
            ok: true,
            title: t('aud7Title', { mode: s.stage_mode === 'quiz_qr' ? t('aud7ModeQuiz') : (s.stage_mode === 'winner_reveal' ? t('aud7ModeWin') : t('aud7ModeVote')) }),
            desc: t('aud7Desc'),
            badge: t('aud7Badge'),
            actionTab: 'stage',
            actionLbl: t('aud7Action')
          },
          {
            ok: true,
            title: t('aud8Title'),
            desc: t('aud8Desc', { quizRound: s.quiz_epoch || 1, voteRound: s.vote_epoch || 1 }),
            badge: t('aud8Badge', { voteRound: s.vote_epoch || 1 }),
            actionTab: 'stage',
            actionLbl: t('aud8Action')
          }
        ];

        return (
          '<div class="tepa-bo-card" style="margin-bottom:16px;">' +
          '  <div class="tepa-bo-card-head">' +
          '    <div>' +
          '      <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('shield', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('audReportTitle')) + '</h2></div>' +
          '      <p class="tepa-bo-card-desc">' + esc(t('audReportDesc')) + '</p>' +
          '    </div>' +
          '    <span class="tepa-bo-badge is-green" style="height:30px;padding:0 12px;">' + icon('check', 13) + ' ' + esc(t('audAllOk')) + '</span>' +
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
        '    <h3 class="tepa-bo-card-title">' + esc(t('setQr1')) + '</h3>' +
        '    <div class="tepa-bo-qr-box" id="tepa-admin-qr-vote"></div>' +
        '    <div class="tepa-bo-qr-url">' + esc(voteAbs) + '</div>' +
        '    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="copy-text" data-text="' + esc(voteAbs) + '" data-label="' + esc(t('setVotingUrl')) + '">' + icon('copy', 12) + '<span>' + esc(t('setCopyLink')) + '</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="download-qr" data-target="tepa-admin-qr-vote" data-filename="tepa-voting-qr.svg">' + icon('download', 12) + '<span>SVG</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-dark" data-action="download-qr-png" data-target="tepa-admin-qr-vote" data-filename="tepa-voting-qr.png">' + icon('download', 12) + '<span>PNG 1024px</span></button>' +
        '    </div>' +
        '  </div>' +
        '  <div class="tepa-bo-card tepa-bo-qr-card">' +
        '    <h3 class="tepa-bo-card-title">' + esc(t('setQr2')) + '</h3>' +
        '    <div class="tepa-bo-qr-box" id="tepa-admin-qr-quiz"></div>' +
        '    <div class="tepa-bo-qr-url">' + esc(quizAbs) + '</div>' +
        '    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="copy-text" data-text="' + esc(quizAbs) + '" data-label="' + esc(t('setQuizUrl')) + '">' + icon('copy', 12) + '<span>' + esc(t('setCopyLink')) + '</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="download-qr" data-target="tepa-admin-qr-quiz" data-filename="tepa-quiz-qr.svg">' + icon('download', 12) + '<span>SVG</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-dark" data-action="download-qr-png" data-target="tepa-admin-qr-quiz" data-filename="tepa-quiz-qr.png">' + icon('download', 12) + '<span>PNG 1024px</span></button>' +
        '    </div>' +
        '  </div>' +
        '  <div class="tepa-bo-card tepa-bo-qr-card">' +
        '    <h3 class="tepa-bo-card-title">' + esc(t('setQr3')) + '</h3>' +
        '    <div class="tepa-bo-qr-box" id="tepa-admin-qr-live"></div>' +
        '    <div class="tepa-bo-qr-url">' + esc(liveAbs) + '</div>' +
        '    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="copy-text" data-text="' + esc(liveAbs) + '" data-label="' + esc(t('setLiveUrl')) + '">' + icon('copy', 12) + '<span>' + esc(t('setCopyLink')) + '</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="download-qr" data-target="tepa-admin-qr-live" data-filename="tepa-live-qr.svg">' + icon('download', 12) + '<span>SVG</span></button>' +
        '      <button type="button" class="tepa-bo-btn tepa-bo-btn-sm tepa-bo-btn-dark" data-action="download-qr-png" data-target="tepa-admin-qr-live" data-filename="tepa-live-qr.png">' + icon('download', 12) + '<span>PNG 1024px</span></button>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="tepa-bo-card" style="margin-bottom:16px;">' +
        '  <div class="tepa-bo-card-head">' +
        '    <div>' +
        '      <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('globe', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('langCardTitle')) + '</h2></div>' +
        '      <p class="tepa-bo-card-desc">' + esc(t('langCardDesc')) + '</p>' +
        '    </div>' +
        '    <span class="tepa-bo-badge is-blue">' + icon('globe', 12) + ' ' + esc(state.lang === 'pt' ? 'PT · Português' : 'EN · English') + '</span>' +
        '  </div>' +
        '  <div class="tepa-bo-lang-grid">' +
        '    <button type="button" class="tepa-bo-lang-option ' + (state.lang === 'pt' ? 'is-active' : '') + '" data-action="set-admin-lang" data-lang="pt">' +
        '      <div style="display:flex;align-items:center;gap:12px;">' +
        '        <span class="tepa-bo-lang-code-pill">PT</span>' +
        '        <div>' +
        '          <div class="tepa-bo-stage-title">' + esc(t('langPtName')) + '</div>' +
        '          <div class="tepa-bo-stage-desc">' + esc(t('langPtDesc')) + '</div>' +
        '        </div>' +
        '      </div>' +
        (state.lang === 'pt' ? '<span class="tepa-bo-badge is-green">' + icon('check', 11) + ' ' + esc(t('langBadgeActive')) + '</span>' : '') +
        '    </button>' +
        '    <button type="button" class="tepa-bo-lang-option ' + (state.lang === 'en' ? 'is-active' : '') + '" data-action="set-admin-lang" data-lang="en">' +
        '      <div style="display:flex;align-items:center;gap:12px;">' +
        '        <span class="tepa-bo-lang-code-pill">EN</span>' +
        '        <div>' +
        '          <div class="tepa-bo-stage-title">' + esc(t('langEnName')) + '</div>' +
        '          <div class="tepa-bo-stage-desc">' + esc(t('langEnDesc')) + '</div>' +
        '        </div>' +
        '      </div>' +
        (state.lang === 'en' ? '<span class="tepa-bo-badge is-green">' + icon('check', 11) + ' ' + esc(t('langBadgeActive')) + '</span>' : '') +
        '    </button>' +
        '  </div>' +
        '</div>' +
        '<div class="tepa-bo-grid-2">' +
        '  <div class="tepa-bo-card">' +
        '    <div class="tepa-bo-card-head">' +
        '      <div>' +
        '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('radio', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('setDbTitle')) + '</h2></div>' +
        '        <p class="tepa-bo-card-desc">' + esc(t('setDbDesc')) + '</p>' +
        '      </div>' +
        '      <span class="tepa-bo-badge ' + (mode === 'supabase' ? 'is-green' : 'is-gold') + '">' + esc(mode === 'supabase' ? t('setConnected') : t('setDemoActive')) + '</span>' +
        '    </div>' +
        (hasWpTpl
          ? '<div id="tepa-wp-settings-mount"></div>'
          : '<div class="tepa-bo-field">' +
            '  <div class="tepa-bo-label">' + esc(t('setProjectUrl')) + '</div>' +
            '  <div class="tepa-bo-qr-url">' + esc(cfg.supabaseUrl || t('setNotConfigured')) + '</div>' +
            '</div>' +
            '<div class="tepa-bo-field">' +
            '  <div class="tepa-bo-label">' + esc(t('setActiveMode')) + '</div>' +
            '  <p>' + esc(mode === 'supabase' ? t('setModeLiveDesc') : t('setModeDemoDesc')) + '</p>' +
            '</div>') +
        '  </div>' +
        '  <div class="tepa-bo-card">' +
        '    <div class="tepa-bo-card-head">' +
        '      <div>' +
        '        <div class="tepa-bo-card-title-row"><span class="tepa-bo-card-icon">' + icon('lock', 15) + '</span><h2 class="tepa-bo-card-title">' + esc(t('setPinTitle')) + '</h2></div>' +
        '        <p class="tepa-bo-card-desc">' + esc(t('setPinDesc')) + '</p>' +
        '      </div>' +
        '      <span class="tepa-bo-badge is-muted">' + esc(t('setPinBadge')) + '</span>' +
        '    </div>' +
        '    <form id="tepa-change-pin-form">' +
        '      <div class="tepa-bo-field">' +
        '        <label class="tepa-bo-label" for="tepa-new-pin">' + esc(t('setNewPinLbl')) + '</label>' +
        '        <input id="tepa-new-pin" class="tepa-bo-input" type="password" minlength="4" placeholder="' + esc(t('setNewPinPh')) + '" required>' +
        '      </div>' +
        '      <div class="tepa-bo-field">' +
        '        <label class="tepa-bo-label" for="tepa-confirm-pin">' + esc(t('setConfirmPinLbl')) + '</label>' +
        '        <input id="tepa-confirm-pin" class="tepa-bo-input" type="password" minlength="4" placeholder="' + esc(t('setConfirmPinPh')) + '" required>' +
        '      </div>' +
        '      <div style="display:flex;justify-content:flex-end;">' +
        '        <button type="submit" class="tepa-bo-btn tepa-bo-btn-dark">' + icon('check', 14) + '<span>' + esc(t('setUpdatePinBtn')) + '</span></button>' +
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

    function render(animateTab, forceFullShell) {
      var mode = Store.getMode();
      var cfg = Store.getConfig();
      var hasWpTpl = Boolean(document.getElementById('tepa-wp-settings-tpl'));
      applyDocumentLang();

      // 0. Strict WordPress-Only Access Gate
      if (cfg.requireWpAdmin && !cfg.isWpAdmin) {
        root.innerHTML =
          '<div class="tepa-bo tepa-anim-enter" style="padding:48px 20px;">' +
          '  <div class="tepa-bo-unlock-wrap">' +
          '    <div class="tepa-bo-card has-rainbow">' +
          '      <div class="tepa-bo-rainbow-bar"></div>' +
          '      <div style="padding-top:20px;">' +
          '        <div class="tepa-bo-unlock-head">' +
          renderBrandBlock('<span class="tepa-bo-badge is-red">' + icon('lock', 12) + ' ' + esc(t('wpOnlyBadge')) + '</span>') +
          buildLangSwitcherHtml() +
          '        </div>' +
          '        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #E2E8F0;">' +
          '          <h2 class="tepa-bo-card-title" style="margin-bottom:6px;">' + esc(t('wpOnlyTitle')) + '</h2>' +
          '          <p class="tepa-bo-card-desc" style="margin-bottom:18px;">' + esc(t('wpOnlyDesc')) + '</p>' +
          '          <a href="' + esc(cfg.adminUrl || '/wp-admin/admin.php?page=tepa-award-2026') + '" class="tepa-bo-btn tepa-bo-btn-primary" style="width:100%;height:42px;">' + esc(t('wpOnlyBtn')) + '</a>' +
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
          '        <div class="tepa-bo-unlock-head">' +
          renderBrandBlock('<span class="tepa-bo-status-pill is-live"><span class="tepa-bo-status-dot"></span> ' + esc(t('unlockLivePill')) + '</span>') +
          buildLangSwitcherHtml() +
          '        </div>' +
          '        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #E2E8F0;">' +
          '          <h2 class="tepa-bo-card-title" style="margin-bottom:4px;">' + esc(t('unlockTitle')) + '</h2>' +
          '          <p class="tepa-bo-card-desc" style="margin-bottom:14px;">' + esc(t('unlockDesc')) + '</p>' +
          '          <form id="tepa-pin-form">' +
          '            <div class="tepa-bo-field">' +
          '              <label class="tepa-bo-label" for="tepa-pin-input">' + esc(t('unlockPinLabel')) + '</label>' +
          '              <input id="tepa-pin-input" type="password" class="tepa-bo-input" placeholder="' + esc(t('unlockPinPlaceholder')) + '" autocomplete="current-password" required>' +
          '            </div>' +
          (state.error ? '<div class="tepa-bo-alert is-error" style="margin-bottom:12px;">' + esc(state.error) + '</div>' : '') +
          '            <button type="submit" class="tepa-bo-btn tepa-bo-btn-primary" style="width:100%;height:42px;">' + icon('lock', 14) + '<span>' + esc(t('unlockBtn')) + '</span></button>' +
          '          </form>' +
          '        </div>' +
          '      </div>' +
          '    </div>' +
          (hasWpTpl
            ? '<details class="tepa-bo-card tepa-bo-details">' +
              '  <summary><span>' + esc(t('unlockWpDetails')) + '</span><span class="tepa-bo-badge is-muted">' + esc(t('unlockWpBadge')) + '</span></summary>' +
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
          '      <p style="font-weight:600;color:#0F172A;">' + esc(t('loadingBackoffice')) + '</p>' +
          (state.error ? '<p style="color:#B91C1C;margin-top:8px;">' + esc(state.error) + '</p>' : '') +
          '    </div>' +
          '  </div>' +
          '</div>';
        return;
      }

      var existingPanel = root.querySelector('#tepa-bo-tab-panel');
      var existingShell = root.querySelector('#tepa-bo-shell');
      if (existingShell && existingPanel && !forceFullShell) {
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
      var meta = getSectionMeta(state.tab);
      var stageBadgeText = s.stage_mode === 'quiz_qr' ? t('badgeStageQuiz') : (s.stage_mode === 'winner_reveal' ? t('badgeStageWinner') : t('badgeStageVoting'));

      root.innerHTML =
        '<div class="tepa-bo tepa-bo-app' + (forceFullShell ? '' : ' tepa-anim-enter') + '" id="tepa-bo-shell">' +
        '  <aside class="tepa-bo-sidebar" aria-label="TEPA Navigation">' +
        '    <div class="tepa-bo-rainbow-bar"></div>' +
        '    <div class="tepa-bo-side-brand">' +
        '      <div class="tepa-bo-side-logos">' +
        '        <span class="tepa-bo-side-te-pill"><img src="' + esc(assetUrl('totalenergies-logo.png')) + '" alt="TotalEnergies"></span>' +
        '        <img class="tepa-bo-side-lu-logo" src="' + esc(assetUrl('light-up-logo.png')) + '" alt="LIGHT UP">' +
        '      </div>' +
        '      <div>' +
        '        <div class="tepa-bo-side-title">TEPA Award 2026</div>' +
        '        <div class="tepa-bo-side-sub">' + esc(t('sideSubtitle')) + '</div>' +
        '      </div>' +
        (mode === 'demo'
          ? '<span class="tepa-bo-side-rt is-demo"><span class="tepa-bo-status-dot"></span> ' + esc(t('sideDemoBadge')) + '</span>'
          : '') +
        '    </div>' +
        '    <nav class="tepa-bo-side-nav" aria-label="Backoffice Sections">' +
        '      <div class="tepa-bo-side-group-lbl">' + esc(t('sideGroupControl')) + '</div>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'stage' ? 'is-active' : '') + '" data-tab="stage">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('radio', 15) + '</span><span>' + esc(t('navStage')) + '</span></span>' +
        '        <span class="tepa-bo-nav-badge is-live" data-tab-count="stage">' + esc(stageBadgeText) + '</span>' +
        '      </button>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'livescreen' ? 'is-active' : '') + '" data-tab="livescreen">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('monitor', 15) + '</span><span>' + esc(t('navLiveScreen')) + '</span></span>' +
        '        <span class="tepa-bo-nav-badge" data-tab-count="livescreen">' + esc((s.live_theme === 'dark' ? t('themeDark') : t('themeLight')) + ' · ' + (s.stage_mode === 'quiz_qr' ? 'S1' : (s.stage_mode === 'winner_reveal' ? 'S3' : 'S2'))) + '</span>' +
        '      </button>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'questions' ? 'is-active' : '') + '" data-tab="questions">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('sparkles', 15) + '</span><span>' + esc(t('navQuiz')) + '</span></span>' +
        '        <span class="tepa-bo-nav-badge" data-tab-count="questions">' + quizQs.length + '</span>' +
        '      </button>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'projects' ? 'is-active' : '') + '" data-tab="projects">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('trophy', 15) + '</span><span>' + esc(t('navProjects')) + '</span></span>' +
        '        <span class="tepa-bo-nav-badge" data-tab-count="projects">' + (activeSelProjCount === selProjs.length ? selProjs.length : (activeSelProjCount + '/' + selProjs.length)) + '</span>' +
        '      </button>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'submissions' ? 'is-active' : '') + '" data-tab="submissions">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('gift', 15) + '</span><span>' + esc(t('navSubmissions')) + '</span></span>' +
        '        <span class="tepa-bo-nav-badge" data-tab-count="submissions">' + subs.length + '</span>' +
        '      </button>' +
        '      <div class="tepa-bo-side-group-lbl">' + esc(t('sideGroupSystem')) + '</div>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'settings' ? 'is-active' : '') + '" data-tab="settings">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('qr', 15) + '</span><span>' + esc(t('navSettings')) + '</span></span>' +
        '      </button>' +
        '      <button type="button" class="tepa-bo-nav-item tepa-bo-tab ' + (state.tab === 'audit' ? 'is-active' : '') + '" data-tab="audit">' +
        '        <span class="tepa-bo-nav-left"><span class="tepa-bo-nav-icon">' + icon('shield', 15) + '</span><span>' + esc(t('navAudit')) + '</span></span>' +
        '        <span class="tepa-bo-nav-badge is-live">OK</span>' +
        '      </button>' +
        '    </nav>' +
        '    <div class="tepa-bo-side-footer">' +
        '      <a href="' + esc(liveScreenUrl) + '" target="_blank" class="tepa-bo-side-link is-primary">' + icon('monitor', 14) + '<span>' + esc(t('sideOpenLive')) + '</span>' + icon('external', 12) + '</a>' +
        '      <div class="tepa-bo-side-launch-grid">' +
        '        <a href="' + esc(quizScreenUrl) + '" target="_blank" class="tepa-bo-side-link">' + icon('help', 13) + '<span>' + esc(t('sideQuiz')) + '</span>' + icon('external', 11) + '</a>' +
        '        <a href="' + esc(voteScreenUrl) + '" target="_blank" class="tepa-bo-side-link">' + icon('vote', 13) + '<span>' + esc(t('sideVoting')) + '</span>' + icon('external', 11) + '</a>' +
        '      </div>' +
        '      <div class="tepa-bo-wp-meta">' +
        '        <div class="tepa-bo-wp-meta-row">' +
        '          <span style="display:inline-flex;align-items:center;gap:5px;">' + icon('lock', 11) + ' ' + esc(t('sideWpAdmin')) + '</span>' +
        '          <strong style="color:#E2E8F0;">' + esc(cfg.wpUserDisplay || 'Admin') + '</strong>' +
        '        </div>' +
        '        <div class="tepa-bo-side-launch-grid">' +
        (cfg.wpDashboardUrl
          ? '<a href="' + esc(cfg.wpDashboardUrl) + '" class="tepa-bo-side-link" title="' + esc(t('sideBackWpTitle')) + '">' + icon('arrowLeft', 12) + '<span>' + esc(t('sideBackWp')) + '</span></a>' +
            '<button type="button" class="tepa-bo-side-link" data-action="toggle-wp-chrome" title="' + esc(t('sideWpMenuTitle')) + '">' + icon('layout', 12) + '<span>' + esc(t('sideWpMenu')) + '</span></button>'
          : '<button type="button" class="tepa-bo-side-link" data-action="toggle-wp-chrome" title="' + esc(t('sideFullscreenTitle')) + '">' + icon('maximize', 12) + '<span>' + esc(t('sideFullscreen')) + '</span></button>' +
            (mode === 'supabase'
              ? '<button type="button" class="tepa-bo-side-link" data-action="lock-admin" title="' + esc(t('sideLockTitle')) + '">' + icon('lock', 12) + '<span>' + esc(t('sideLock')) + '</span></button>'
              : '<button type="button" class="tepa-bo-side-link" data-tab="audit">' + icon('shield', 12) + '<span>' + esc(t('sideAudit')) + '</span></button>')) +
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
        '        <div class="tepa-bo-quick-stage" title="' + esc(t('quickStageTitle')) + '">' +
        '          <span class="tepa-bo-quick-stage-lbl">' + icon('monitor', 12) + '<span>' + esc(t('quickStageLbl')) + '</span></span>' +
        '          <button type="button" class="tepa-bo-quick-stage-btn ' + (s.stage_mode === 'quiz_qr' ? 'is-active' : '') + '" data-quick-stage data-action="set-stage" data-val="quiz_qr">' + esc(t('quickStage1')) + '</button>' +
        '          <button type="button" class="tepa-bo-quick-stage-btn ' + (s.stage_mode === 'live_voting' ? 'is-active' : '') + '" data-quick-stage data-action="set-stage" data-val="live_voting">' + esc(t('quickStage2')) + '</button>' +
        '          <button type="button" class="tepa-bo-quick-stage-btn ' + (s.stage_mode === 'winner_reveal' ? 'is-active' : '') + '" data-quick-stage data-action="set-stage" data-val="winner_reveal">' + esc(t('quickStage3')) + '</button>' +
        '        </div>' +
        buildLangSwitcherHtml() +
        (mode === 'supabase' && cfg.wpDashboardUrl
          ? '<button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-action="lock-admin" title="' + esc(t('sideLockTitle')) + '">' + icon('lock', 13) + '<span>' + esc(t('sideLock')) + '</span></button>'
          : '') +
        '      </div>' +
        '    </header>' +
        '    <div class="tepa-bo-content">' +
        (mode === 'demo'
          ? '<div class="tepa-bo-alert is-warn">' +
            '  <div><strong>' + esc(t('demoAlertStrong')) + '</strong> ' + esc(t('demoAlertBody')) +
            (hasWpTpl ? ' ' + esc(t('demoAlertWpHint')) : '') +
            '  </div>' +
            '  <button type="button" class="tepa-bo-btn tepa-bo-btn-sm" data-tab="settings"><span>' + esc(t('demoAlertBtn')) + '</span>' + icon('arrowRight', 12) + '</button>' +
            '</div>'
          : '') +
        (state.error ? '<div class="tepa-bo-alert is-error"><div><strong>' + esc(t('actionNotice')) + '</strong> ' + esc(state.error) + '</div></div>' : '') +
        '      <section class="tepa-bo-kpis">' +
        '        <div class="tepa-bo-kpi-card" data-tab="projects" title="' + esc(t('kpiVotesTitle')) + '">' +
        '          <div class="tepa-bo-kpi-head">' +
        '            <span class="tepa-bo-kpi-icon is-orange">' + icon('barChart', 18) + '</span>' +
        '            <span data-kpi-votes-badge class="tepa-bo-badge ' + (s.voting_open ? 'is-green' : 'is-red') + '">' + esc(s.voting_open ? t('kpiVotingOpen') : t('kpiVotingClosed')) + '</span>' +
        '          </div>' +
        '          <div class="tepa-bo-kpi-label">' + esc(t('kpiVotesLabel')) + '</div>' +
        '          <div class="tepa-bo-kpi-value" data-kpi-votes>' + esc(k.totalVotes) + '</div>' +
        '          <div class="tepa-bo-kpi-sub" data-kpi-votes-sub>' + esc(t(k.isSimpleActivePoll ? 'kpiVotesSubOpts' : 'kpiVotesSubProjs', { round: s.vote_epoch || 1, count: k.activeProjects.length })) + '</div>' +
        '        </div>' +
        '        <div class="tepa-bo-kpi-card" data-tab="stage" title="' + esc(t('kpiLeaderTitle')) + '">' +
        '          <div class="tepa-bo-kpi-head">' +
        '            <span class="tepa-bo-kpi-icon is-blue">' + icon('trophy', 18) + '</span>' +
        '            <span class="tepa-bo-badge is-blue">' + esc(k.isSimpleActivePoll ? t('kpiTopChoice') : t('kpiBestOfBest')) + '</span>' +
        '          </div>' +
        '          <div class="tepa-bo-kpi-label">' + esc(t('kpiLeaderLabel')) + '</div>' +
        '          <div class="tepa-bo-kpi-value is-text" data-kpi-leader title="' + esc(k.leader ? k.leader.project_title : '') + '">' + esc(k.leader ? k.leader.project_title : t('kpiNoVotesYet')) + '</div>' +
        '          <div class="tepa-bo-kpi-sub" data-kpi-leader-sub>' + esc(k.leader ? (t('kpiLeaderVotes', { votes: k.leader.votes || 0, pct: k.leaderPct }) + (k.leader.category_name ? (' · ' + k.leader.category_name) : '')) : t('kpiWaitingVote')) + '</div>' +
        '        </div>' +
        '        <div class="tepa-bo-kpi-card" data-tab="questions" title="' + esc(t('kpiQuizTitle')) + '">' +
        '          <div class="tepa-bo-kpi-head">' +
        '            <span class="tepa-bo-kpi-icon is-purple">' + icon('users', 18) + '</span>' +
        '            <span data-kpi-quiz-badge class="tepa-bo-badge ' + (s.quiz_open ? 'is-green' : 'is-red') + '">' + esc(s.quiz_open ? t('kpiQuizOpen') : t('kpiQuizClosed')) + '</span>' +
        '          </div>' +
        '          <div class="tepa-bo-kpi-label">' + esc(t('kpiQuizLabel')) + '</div>' +
        '          <div class="tepa-bo-kpi-value" data-kpi-quiz>' + esc(subs.length) + '</div>' +
        '          <div class="tepa-bo-kpi-sub" data-kpi-quiz-sub>' + esc(t('kpiQuizSub', { passed: k.passedCount, round: s.quiz_epoch || 1 })) + '</div>' +
        '        </div>' +
        '        <div class="tepa-bo-kpi-card" data-tab="submissions" title="' + esc(t('kpiVouchersTitle')) + '">' +
        '          <div class="tepa-bo-kpi-head">' +
        '            <span class="tepa-bo-kpi-icon is-amber">' + icon('ticket', 18) + '</span>' +
        '            <span data-kpi-vouchers-badge class="tepa-bo-badge is-gold">' + esc(t('kpiFirstN', { max: k.maxVouchers })) + '</span>' +
        '          </div>' +
        '          <div class="tepa-bo-kpi-label">' + esc(t('kpiVouchersLabel')) + '</div>' +
        '          <div class="tepa-bo-kpi-value" data-kpi-vouchers>' + esc(k.voucherWinners.length) + ' / ' + esc(k.maxVouchers) + '</div>' +
        '          <div class="tepa-bo-kpi-sub" data-kpi-vouchers-sub>' + esc(t('kpiVouchersSub', { count: k.redeemedCount })) + '</div>' +
        '          <div class="tepa-bo-progress"><div class="tepa-bo-progress-fill" data-kpi-vouchers-bar style="width:' + k.voucherPct + '%;"></div></div>' +
        '        </div>' +
        '      </section>' +
        '      <div id="tepa-bo-tab-panel" class="' + (forceFullShell ? '' : 'tepa-anim-tab') + '">' + buildTabPanelHtml() + '</div>' +
        '    </div>' +
        '  </div>' +
        '  <div id="tepa-bo-floating-slot"></div>' +
        '  <div id="tepa-bo-modal-slot"></div>' +
        '</div>';

      if (!state.hasAnimatedKpis) {
        patchKpisInPlace(state.data, true);
        state.hasAnimatedKpis = true;
      }
      if (forceFullShell) {
        syncTabsInPlace(state.data);
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
          flash(t('toastRulesSaved'));
        } else {
          flash((rRes && rRes.error) || t('toastRulesErr'), true);
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
          flash(t('toastQuizSaved'));
        } else {
          flash((qzRes && qzRes.error) || t('toastQuizErr'), true);
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
          flash(t('toastPollSaved'));
        } else {
          flash((plRes && plRes.error) || t('toastPollErr'), true);
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
          flash(t('toastTitlesSaved'));
        } else {
          flash((lsRes && lsRes.error) || t('toastTitlesErr'), true);
        }
        return;
      }

      if (ev.target.id === 'tepa-change-pin-form') {
        ev.preventDefault();
        var p1 = ((root.querySelector('#tepa-new-pin') || {}).value || '').trim();
        var p2 = ((root.querySelector('#tepa-confirm-pin') || {}).value || '').trim();
        if (p1.length < 4) {
          flash(t('toastPinMin'), true);
          return;
        }
        if (p1 !== p2) {
          flash(t('toastPinMismatch'), true);
          return;
        }
        var pRes = await Store.adminAction(state.pin || '2026', 'change_pin', { new_pin: p1 });
        if (pRes && pRes.ok) {
          state.pin = p1;
          try { sessionStorage.setItem(PIN_SESSION_KEY, p1); } catch (e) {}
          ev.target.reset();
          flash(t('toastPinUpdated'));
        } else {
          flash((pRes && pRes.error) || t('toastPinErr'), true);
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

      if (act === 'set-admin-lang') {
        var nextLang = AdminI18n.saveLang(btn.getAttribute('data-lang'));
        if (nextLang !== state.lang) {
          state.lang = nextLang;
          applyDocumentLang();
          render(false, true);
          flash(t('langSwitched', { lang: nextLang === 'pt' ? 'Português' : 'English' }));
        }
        return;
      }

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
        var stageLbl = stageVal === 'quiz_qr' ? t('aud7ModeQuiz') : (stageVal === 'winner_reveal' ? t('aud7ModeWin') : t('aud7ModeVote'));
        flash(t('toastStageSwitched', { stage: stageLbl }));
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
          flash(t('toastLiveUpdated'));
        } else {
          flash((prefRes && prefRes.error) || t('toastLiveErr'), true);
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
            flash(tPayload[tKey] ? t('toastQuizWinAnnounced') : t('toastQuizWinHidden'));
          } else if (tKey === 'quiz_open') {
            flash(tPayload[tKey] ? t('toastGateQuizOpen') : t('toastGateQuizClosed'));
          } else {
            flash(tPayload[tKey] ? t('toastGateVoteOpen') : t('toastGateVoteClosed'));
          }
        } else {
          flash((tResClick && tResClick.error) || t('toastSettingErr'), true);
        }
        return;
      }

      if (act === 'simulate-votes') {
        var simCount = Number(btn.getAttribute('data-count') || 5);
        await Store.adminAction(pin, 'simulate_votes', { count: simCount });
        await loadAdmin(false);
        flash(t('toastSimVotes', { count: simCount }));
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
        flash(t('toastEnableAll'));
        return;
      }

      if (act === 'open-confirm-modal') {
        var kind = btn.getAttribute('data-modal-kind') || 'reset';
        var itemId = btn.getAttribute('data-id');
        if (kind === 'reset') {
          var sc = btn.getAttribute('data-scope') || 'all';
          var modalMap = {
            votes: {
              title: t('modResetVotesTitle'),
              message: t('modResetVotesMsg'),
              confirmLabel: t('modResetVotesBtn'),
              action: 'reset_event_data',
              payload: { scope: 'votes' }
            },
            quiz: {
              title: t('modResetQuizTitle'),
              message: t('modResetQuizMsg'),
              confirmLabel: t('modResetQuizBtn'),
              action: 'reset_event_data',
              payload: { scope: 'quiz' }
            },
            all: {
              title: t('modResetAllTitle'),
              message: t('modResetAllMsg'),
              confirmLabel: t('modResetAllBtn'),
              action: 'reset_event_data',
              payload: { scope: 'all' }
            },
            seed: {
              title: t('modResetSeedTitle'),
              message: t('modResetSeedMsg'),
              confirmLabel: t('modResetSeedBtn'),
              action: 'reset_event_data',
              payload: { scope: 'seed' }
            }
          };
          state.confirmModal = modalMap[sc] || modalMap.all;
        } else if (kind === 'archive_quiz') {
          state.confirmModal = {
            title: t('modDelQuizTitle'),
            message: t('modDelQuizMsg'),
            confirmLabel: t('modDelQuizBtn'),
            action: 'archive_quiz',
            payload: { id: itemId }
          };
        } else if (kind === 'archive_poll') {
          state.confirmModal = {
            title: t('modDelPollTitle'),
            message: t('modDelPollMsg'),
            confirmLabel: t('modDelPollBtn'),
            action: 'archive_poll',
            payload: { id: itemId }
          };
        } else if (kind === 'archive_question') {
          state.confirmModal = {
            title: t('modDelQTitle'),
            message: t('modDelQMsg'),
            confirmLabel: t('modDelQBtn'),
            action: 'archive_question',
            payload: { id: Number(itemId) }
          };
        } else if (kind === 'archive_project') {
          state.confirmModal = {
            title: t('modDelProjTitle'),
            message: t('modDelProjMsg'),
            confirmLabel: t('modDelProjBtn'),
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
          flash(t('toastUpdated'));
        } else {
          flash((mRes && mRes.error) || t('toastActionFailed'), true);
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
          flash(t('toastQuizCreated'));
        } else {
          flash((cqRes && cqRes.error) || t('toastQuizCreateErr'), true);
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
          flash(t('toastQuizDup'));
        } else {
          flash((dupRes && dupRes.error) || t('toastQuizDupErr'), true);
        }
        return;
      }

      if (act === 'activate-quiz') {
        var actQuizId = btn.getAttribute('data-id');
        var resetRound = btn.getAttribute('data-reset') === 'true';
        var actRes = await Store.adminAction(pin, 'activate_quiz', { id: actQuizId, reset_round: resetRound });
        if (actRes && actRes.ok) {
          await loadAdmin(false);
          flash(resetRound ? t('toastQuizActReset') : t('toastQuizActLive'));
        } else {
          flash((actRes && actRes.error) || t('toastQuizActErr'), true);
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
          flash(t('toastPollCreated'));
        } else {
          flash((cplRes && cplRes.error) || t('toastPollCreateErr'), true);
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
          flash(t('toastPollDup'));
        } else {
          flash((dupPollRes && dupPollRes.error) || t('toastPollDupErr'), true);
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
          flash(resetPollRound ? t('toastPollActReset') : t('toastPollActLive'));
        } else {
          flash((actPollRes && actPollRes.error) || t('toastPollActErr'), true);
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
          flash(t('toastQAdded'));
        } else {
          flash((newQRes && newQRes.error) || t('toastQAddErr'), true);
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
          flash(t('toastQOrderUpdated'));
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
          flash(t('toastQSaved'));
        }
        return;
      }

      if (act === 'discard-questions') {
        state.dirtyQuestions = {};
        render(false);
        flash(t('toastQDiscarded'));
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
            flash(t('toastQBulkSaved', { count: qBulkRes.count || qItems.length }));
          } else {
            flash((qBulkRes && qBulkRes.error) || t('toastQBulkErr'), true);
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
          flash(isSimplePl ? t('toastOptAdded') : t('toastProjAdded'));
        } else {
          flash((cpRes && cpRes.error) || t('toastItemAddErr'), true);
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
          flash(t('toastOrderUpdated'));
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
              flash(t('toastItemSaved', { id: pid }));
            } else {
              flash((spRes && spRes.error) || t('toastItemSaveErr'), true);
            }
          }
        }
        return;
      }

      if (act === 'discard-projects') {
        state.dirtyProjects = {};
        render(false);
        flash(t('toastEditsDiscarded'));
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
            flash(t('toastItemsBulkSaved', { count: pBulkRes.count || pItems.length }));
          } else {
            flash((pBulkRes && pBulkRes.error) || t('toastItemsBulkErr'), true);
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
        flash(t('toastVoucherUpdated'));
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
          flash(revealVal ? t('toastQuizWinAnnounced') : t('toastQuizWinHidden'));
        } else {
          flash((annRes && annRes.error) || t('toastAnnounceErr'), true);
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
