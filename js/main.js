$(document).ready(function () {

  /* ============================================================
     UTILITIES
  ============================================================ */
  function localStorageSafeGet(key){ try { return localStorage.getItem(key); } catch(e){ return null; } }
  function localStorageSafeSet(key, val){ try { localStorage.setItem(key, val); } catch(e){ /* no-op */ } }

  /* ============================================================
     MODULE: Theme (dark / light)
  ============================================================ */
  const Theme = {
    init() {
      const saved = localStorageSafeGet('moodshop-theme') || 'light';
      this.apply(saved);
      $('#themeSwitch').on('click', () => this.toggle());
    },
    toggle() {
      const current = $('html').attr('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      this.apply(next);
      localStorageSafeSet('moodshop-theme', next);
      Charts.refreshColors();
    },
    apply(mode) {
      $('html').attr('data-theme', mode);
      $('#themeIcon')
        .toggleClass('bi-sun-fill', mode === 'light')
        .toggleClass('bi-moon-stars-fill', mode === 'dark')
        .css('color', mode === 'light' ? '#d9a130' : '#c7c3dc');
    }
  };

  /* ============================================================
     MODULE: Sidebar (desktop collapse + mobile drawer only —
     page navigation itself is handled by the Pages module)
  ============================================================ */
  const Sidebar = {
    init() {
      $('#sidebarToggle').on('click', () => this.handleToggle());
      $('#sidebarBackdrop').on('click', () => this.closeMobile());
    },
    isMobile() { return window.innerWidth < 992; },
    handleToggle() {
      if (this.isMobile()) {
        $('#sidebar').toggleClass('mobile-open');
        $('#sidebarBackdrop').toggleClass('show');
      } else {
        $('#sidebar').toggleClass('collapsed');
        $('#appMain').toggleClass('sidebar-collapsed');
      }
    },
    closeMobile() {
      $('#sidebar').removeClass('mobile-open');
      $('#sidebarBackdrop').removeClass('show');
    }
  };

  /* ============================================================
     MODULE: Pages — swaps which <section class="page-section">
     is visible, keeps the sidebar's active state + heading in
     sync, and can highlight a specific element once the target
     page is showing (used by notification links).
  ============================================================ */
  const Pages = {
    subtitles: {
      Overview:  "Here's how shoppers are moving through MoodShop today.",
      Analytics: "Deeper look at shopper behaviour and mood trends.",
      Reports:   "Returns awaiting review and generated exports.",
      Settings:  "Manage your admin profile and preferences."
    },

    init() {
      // Sidebar nav links
      $('.nav-item-link[data-page]').on('click', function (e) {
        e.preventDefault();
        Pages.goTo($(this).data('page'));
        Sidebar.closeMobile();
      });

      // Any other element in the app that wants to deep-link into a
      // page (notification items, "My profile" menu entry, etc.)
      $(document).on('click', '[data-goto]', function (e) {
        e.preventDefault();
        const target = $(this).data('goto');
        const highlight = $(this).data('highlight');
        Pages.goTo(target, { highlight });
      });
    },

    goTo(pageName, opts = {}) {
      if (!pageName) return;
      const slug = pageName.toLowerCase();
      const $section = $('#page-' + slug);
      if ($section.length === 0) return;

      $('.nav-item-link[data-page]').removeClass('active');
      $(`.nav-item-link[data-page="${pageName}"]`).addClass('active');

      $('#pageTitle').text(pageName);
      $('#pageSubtitle').text(this.subtitles[pageName] || '');

      $('.page-section').removeClass('active');
      $section.addClass('active');

      // Bootstrap dropdowns don't always self-close on item click
      $('.dropdown-menu.show').removeClass('show');

      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (opts.highlight) {
        this.highlight(opts.highlight);
      }
    },

    highlight(selector) {
      // small delay lets the page-switch animation/layout settle first
      setTimeout(() => {
        const $el = $(selector);
        if ($el.length === 0) return;
        $el[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        $el.addClass('highlight-pulse');
        setTimeout(() => $el.removeClass('highlight-pulse'), 2000);
      }, 200);
    }
  };

  /* ============================================================
     MODULE: Charts
  ============================================================ */
  const Charts = {
    main: null,
    donut: null,
    gauge: null,
    analytics: null,
    datasets: {
      '12m': {
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
        revenue: [42,45,49,47,53,58,55,61,64,68,72,78],
        users:   [30,33,35,34,38,41,40,44,47,50,54,58]
      },
      '6m': {
        labels: ['Jul','Aug','Sep','Oct','Nov','Dec'],
        revenue: [55,61,64,68,72,78],
        users:   [40,44,47,50,54,58]
      },
      '3m': {
        labels: ['Oct','Nov','Dec'],
        revenue: [68,72,78],
        users:   [50,54,58]
      }
    },
    // the six MoodShop moods
    donutData: {
      labels: ['Happy', 'Celebratory', 'Bored', 'Tired', 'Stressed', 'Romantic'],
      values: [28, 22, 18, 14, 10, 8],
      colors: ['#d9a130', '#c2664f', '#6c5cb0', '#3d6d94', '#4c8268', '#c65d7b']
    },
    // mood trend series shown on the Analytics page
    analyticsData: {
      labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'],
      happy:       [20,22,24,23,25,27,28,29,28],
      stressed:    [16,15,14,13,12,11,11,10,10],
      celebratory: [14,15,16,17,18,19,20,21,22]
    },

    themeColors() {
      const dark = $('html').attr('data-theme') === 'dark';
      return {
        grid: dark ? 'rgba(255,255,255,.07)' : 'rgba(36,30,78,.06)',
        tick: dark ? '#a6a1bd' : '#6f6b7c',
        cardBg: dark ? '#1d1938' : '#ffffff'
      };
    },

    init() {
      this.renderMain('12m');
      this.renderDonut();
      this.renderGauge();
      this.renderAnalytics();
      $('[data-range]').on('click', function () {
        $('[data-range]').removeClass('active');
        $(this).addClass('active');
        Charts.renderMain($(this).data('range'));
      });
    },

    renderMain(range) {
      const c = this.themeColors();
      const d = this.datasets[range];
      const ctx = document.getElementById('mainChart').getContext('2d');

      if (this.main) this.main.destroy();

      this.main = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: d.labels,
          datasets: [
            {
              label: 'Sales (Rs, 000s)',
              data: d.revenue,
              backgroundColor: '#6c5cb0',
              borderRadius: 6,
              maxBarThickness: 22,
              categoryPercentage: 0.6,
              barPercentage: 0.9
            },
            {
              label: 'Active Shoppers (k)',
              data: d.users,
              backgroundColor: '#c2664f',
              borderRadius: 6,
              maxBarThickness: 22,
              categoryPercentage: 0.6,
              barPercentage: 0.9
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          animation: { duration: 600, easing: 'easeOutQuart' },
          plugins: {
            legend: {
              position: 'top', align: 'end',
              labels: { color: c.tick, usePointStyle: true, pointStyle: 'circle', boxWidth: 7, font: { family: 'Manrope', size: 12, weight: 600 } }
            },
            tooltip: {
              backgroundColor: c.cardBg, titleColor: c.tick, bodyColor: c.tick,
              borderColor: 'rgba(0,0,0,.08)', borderWidth: 1, padding: 10,
              titleFont: { family: 'Manrope', weight: 700 }, bodyFont: { family: 'Manrope' }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: c.tick, font: { family: 'Manrope', size: 11.5 } } },
            y: { grid: { color: c.grid }, ticks: { color: c.tick, font: { family: 'Manrope', size: 11.5 } } }
          }
        }
      });
    },

    renderDonut() {
      const c = this.themeColors();
      const ctx = document.getElementById('donutChart').getContext('2d');
      if (this.donut) this.donut.destroy();

      const topIndex = this.donutData.values.indexOf(Math.max(...this.donutData.values));
      const centerTextPlugin = {
        id: 'donutCenterText',
        afterDraw(chart) {
          const { ctx, chartArea: { left, right, top, bottom } } = chart;
          const cx = (left + right) / 2;
          const cy = (top + bottom) / 2;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = c.tick;
          ctx.font = '700 12px Manrope';
          ctx.fillText(Charts.donutData.labels[topIndex], cx, cy - 12);
          ctx.fillStyle = Charts.donutData.colors[topIndex];
          ctx.font = '800 22px Manrope';
          ctx.fillText(Charts.donutData.values[topIndex] + '%', cx, cy + 10);
          ctx.restore();
        }
      };

      this.donut = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: this.donutData.labels,
          datasets: [{
            data: this.donutData.values,
            backgroundColor: this.donutData.colors,
            borderWidth: 3,
            borderColor: c.cardBg,
            hoverOffset: 6
          }]
        },
        plugins: [centerTextPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          animation: { duration: 700, easing: 'easeOutQuart' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: c.cardBg, titleColor: c.tick, bodyColor: c.tick,
              borderColor: 'rgba(0,0,0,.08)', borderWidth: 1, padding: 10
            }
          }
        }
      });

      const $legend = $('#donutLegend').empty();
      this.donutData.labels.forEach((label, i) => {
        $legend.append(`
          <div style="font-size:12.5px; color:var(--text-600);">
            <span class="legend-dot" style="background:${this.donutData.colors[i]};"></span>${label}
            <strong style="color:var(--text-900);">${this.donutData.values[i]}%</strong>
          </div>
        `);
      });
    },

    renderGauge() {
      const c = this.themeColors();
      const ctx = document.getElementById('moodGaugeChart').getContext('2d');
      if (this.gauge) this.gauge.destroy();

      const value = 34.2;
      const gaugeCenterPlugin = {
        id: 'gaugeCenterText',
        afterDraw(chart) {
          const { ctx, chartArea: { left, right, bottom } } = chart;
          const cx = (left + right) / 2;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = '#6c5cb0';
          ctx.font = '800 20px Manrope';
          ctx.fillText(value + '%', cx, bottom - 2);
          ctx.restore();
        }
      };

      this.gauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [value, 100 - value],
            backgroundColor: ['#6c5cb0', c.grid],
            borderWidth: 0
          }]
        },
        plugins: [gaugeCenterPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          circumference: 180,
          rotation: 270,
          cutout: '75%',
          animation: { duration: 700, easing: 'easeOutQuart' },
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
    },

    renderAnalytics() {
      const c = this.themeColors();
      const canvas = document.getElementById('analyticsChart');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (this.analytics) this.analytics.destroy();

      const d = this.analyticsData;
      this.analytics = new Chart(ctx, {
        type: 'line',
        data: {
          labels: d.labels,
          datasets: [
            { label: 'Happy', data: d.happy, borderColor: '#d9a130', backgroundColor: '#d9a130', tension: .35, pointRadius: 2 },
            { label: 'Stressed', data: d.stressed, borderColor: '#4c8268', backgroundColor: '#4c8268', tension: .35, pointRadius: 2 },
            { label: 'Celebratory', data: d.celebratory, borderColor: '#c2664f', backgroundColor: '#c2664f', tension: .35, pointRadius: 2 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600, easing: 'easeOutQuart' },
          plugins: {
            legend: {
              position: 'top', align: 'end',
              labels: { color: c.tick, usePointStyle: true, pointStyle: 'circle', boxWidth: 7, font: { family: 'Manrope', size: 12, weight: 600 } }
            },
            tooltip: {
              backgroundColor: c.cardBg, titleColor: c.tick, bodyColor: c.tick,
              borderColor: 'rgba(0,0,0,.08)', borderWidth: 1, padding: 10
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: c.tick, font: { family: 'Manrope', size: 11.5 } } },
            y: { grid: { color: c.grid }, ticks: { color: c.tick, font: { family: 'Manrope', size: 11.5 } } }
          }
        }
      });
    },

    refreshColors() {
      const activeRange = $('[data-range].active').data('range') || '12m';
      this.renderMain(activeRange);
      this.renderDonut();
      this.renderGauge();
      this.renderAnalytics();
    }
  };

  /* ============================================================
     MODULE: Orders Table (render, search, paginate)
  ============================================================ */
  const TxTable = {
    rowsPerPage: 5,
    currentPage: 1,
    filtered: [],
    moodColors: {
      Happy: '#d9a130', Celebratory: '#c2664f', Bored: '#6c5cb0',
      Tired: '#3d6d94', Stressed: '#4c8268', Romantic: '#c65d7b'
    },
    moodSoft: {
      Happy: 'var(--mood-happy-soft)', Celebratory: 'var(--mood-celebratory-soft)', Bored: 'var(--mood-bored-soft)',
      Tired: 'var(--mood-tired-soft)', Stressed: 'var(--mood-stressed-soft)', Romantic: 'var(--mood-romantic-soft)'
    },
    data: [
      { name: 'Sarah Malik',    initials: 'SM', id: 'ORD-84021', date: 'Sep 10, 2026', mood: 'Happy',       amount: 'Rs 12,400', status: 'completed' },
      { name: 'Hamza Tariq',    initials: 'HT', id: 'ORD-84020', date: 'Sep 10, 2026', mood: 'Stressed',    amount: 'Rs 3,895',  status: 'pending' },
      { name: 'Areeba Nadeem',  initials: 'AN', id: 'ORD-84019', date: 'Sep 09, 2026', mood: 'Celebratory', amount: 'Rs 20,150', status: 'completed' },
      { name: 'Bilal Ahmed',    initials: 'BA', id: 'ORD-84018', date: 'Sep 09, 2026', mood: 'Bored',       amount: 'Rs 762',    status: 'failed' },
      { name: 'Fatima Zahra',   initials: 'FZ', id: 'ORD-84017', date: 'Sep 08, 2026', mood: 'Romantic',    amount: 'Rs 5,400',  status: 'completed' },
      { name: 'Usman Ghani',    initials: 'UG', id: 'ORD-84016', date: 'Sep 08, 2026', mood: 'Tired',       amount: 'Rs 18,908', status: 'pending' },
      { name: 'Mahnoor Sheikh', initials: 'MS', id: 'ORD-84015', date: 'Sep 07, 2026', mood: 'Happy',       amount: 'Rs 3,124',  status: 'completed' },
      { name: 'Ali Raza',       initials: 'AR', id: 'ORD-84014', date: 'Sep 07, 2026', mood: 'Bored',       amount: 'Rs 950',    status: 'failed' },
      { name: 'Zainab Farooq',  initials: 'ZF', id: 'ORD-84013', date: 'Sep 06, 2026', mood: 'Celebratory', amount: 'Rs 41,200', status: 'completed' },
      { name: 'Danish Iqbal',   initials: 'DI', id: 'ORD-84012', date: 'Sep 06, 2026', mood: 'Stressed',    amount: 'Rs 2,100',  status: 'pending' },
      { name: 'Noor ul Ain',    initials: 'NA', id: 'ORD-84011', date: 'Sep 05, 2026', mood: 'Romantic',    amount: 'Rs 6,753',  status: 'completed' },
      { name: 'Kamran Yousuf',  initials: 'KY', id: 'ORD-84010', date: 'Sep 05, 2026', mood: 'Tired',       amount: 'Rs 589',    status: 'failed' }
    ],

    init() {
      this.filtered = this.data;
      this.render();

      $('#tableSearchInput').on('input', function () {
        TxTable.handleSearch($(this).val());
      });

      $('#paginationControls').on('click', '[data-page-nav]', function () {
        TxTable.navigate($(this).data('page-nav'));
      });
    },

    handleSearch(term) {
      const q = term.trim().toLowerCase();
      this.filtered = !q ? this.data : this.data.filter(row =>
        row.name.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        row.mood.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q)
      );
      this.currentPage = 1;
      this.render();
    },

    navigate(action) {
      const totalPages = this.totalPages();
      if (action === 'prev' && this.currentPage > 1) this.currentPage--;
      if (action === 'next' && this.currentPage < totalPages) this.currentPage++;
      if (typeof action === 'number') this.currentPage = action;
      this.render();
    },

    totalPages() { return Math.max(1, Math.ceil(this.filtered.length / this.rowsPerPage)); },

    render() {
      const start = (this.currentPage - 1) * this.rowsPerPage;
      const pageRows = this.filtered.slice(start, start + this.rowsPerPage);
      const $body = $('#txTableBody').empty();

      if (pageRows.length === 0) {
        $body.append(`<tr><td colspan="6" class="text-center py-4" style="color:var(--text-400);">No orders match your search.</td></tr>`);
      } else {
        pageRows.forEach(row => {
          $body.append(`
            <tr id="order-${row.id}">
              <td>
                <div class="user-cell">
                  <div class="mini-avatar">${row.initials}</div>
                  <span style="font-weight:600;">${row.name}</span>
                </div>
              </td>
              <td class="num-tabular text-muted">${row.id}</td>
              <td class="text-muted">${row.date}</td>
              <td>
                <span class="mood-pill" style="background:${this.moodSoft[row.mood]}; color:${this.moodColors[row.mood]};">${row.mood}</span>
              </td>
              <td class="num-tabular" style="font-weight:700;">${row.amount}</td>
              <td><span class="status-pill ${row.status}">${this.capitalize(row.status)}</span></td>
            </tr>
          `);
        });
      }
      this.renderPagination();
    },

    renderPagination() {
      const total = this.filtered.length;
      const totalPages = this.totalPages();
      const start = total === 0 ? 0 : (this.currentPage - 1) * this.rowsPerPage + 1;
      const end = Math.min(this.currentPage * this.rowsPerPage, total);

      $('#paginationInfo').text(`Showing ${start}–${end} of ${total}`);

      const $controls = $('#paginationControls').empty();
      $controls.append(`<button class="page-btn" data-page-nav="prev" ${this.currentPage === 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>`);
      for (let i = 1; i <= totalPages; i++) {
        $controls.append(`<button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page-nav="${i}">${i}</button>`);
      }
      $controls.append(`<button class="page-btn" data-page-nav="next" ${this.currentPage === totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>`);
    },

    capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  };

  /* ============================================================
     MODULE: Settings page (simple, static save feedback)
  ============================================================ */
  const Settings = {
    init() {
      $('#saveSettingsBtn').on('click', function () {
        const $btn = $(this);
        const original = $btn.html();
        $btn.html('<i class="bi bi-check2"></i>Saved!');
        setTimeout(() => $btn.html(original), 1400);
      });
    }
  };

  /* ============================================================
     INIT ALL MODULES
  ============================================================ */
  Theme.init();
  Sidebar.init();
  Pages.init();
  Charts.init();
  TxTable.init();
  Settings.init();

  $(window).on('resize', function () {
    if (window.innerWidth >= 992) {
      $('#sidebar').removeClass('mobile-open');
      $('#sidebarBackdrop').removeClass('show');
    }
  });

});
