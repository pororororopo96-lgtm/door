// modules/admin.js — логика админ-панели «Открытые двери»
import { renderCharts } from './analytics.js';

const CATEGORIES = [
    'Входные двери', 'Межкомнатные двери', 'Складные двери', 'Арки и Порталы',
    'Скрытые двери', 'Специальные двери', 'Фурнитура и прочее'
];

function api(url, options = {}) {
    options.headers = Object.assign({ 'X-Requested-With': 'XMLHttpRequest' }, options.headers || {});
    return fetch(url, options).then(r => r.json());
}

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
const rub = (v) => `${Number(v || 0).toLocaleString('ru-RU')} ₽`;

let editingId = null;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    bindStaticForms();
    checkAccess().then(ok => {
        if (ok) {
            loadDashboard();
            loadProducts();
            loadAnalytics();
        }
    });
});

async function checkAccess() {
    try {
        const s = await api('php/status.php');
        if (!s.loggedIn || !s.isAdmin) {
            $('#accessDenied').style.display = 'block';
            $('#adminApp').style.display = 'none';
            return false;
        }
        $('#adminUser').textContent = s.login;
        return true;
    } catch (e) {
        $('#accessDenied').style.display = 'block';
        $('#adminApp').style.display = 'none';
        return false;
    }
}

function initTabs() {
    document.querySelectorAll('.admin-sidebar .nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.admin-sidebar .nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.tab;
            $(`#section-${target}`)?.classList.add('active');
            if (target === 'analytics') loadAnalytics();
            if (target === 'products') loadProducts();
        });
    });
}

function showMsg(type, text) {
    const m = $('#adminMsg');
    if (!m) return;
    m.className = `admin-msg ${type} show`;
    m.innerHTML = text;
    setTimeout(() => { m.className = 'admin-msg'; }, 4000);
}

/* ===================== ДАШБОРД ===================== */
async function loadDashboard() {
    try {
        const [analytics, orders] = await Promise.all([
            api('php/admin_analytics.php'),
            api('php/admin_orders.php')
        ]);
        $('#statOrders').textContent = analytics.totalOrders;
        $('#statRevenue').textContent = rub(analytics.totalRevenue);
        $('#statCatalog').textContent = analytics.catalogCount;
        $('#statTop').textContent = analytics.topProduct
            ? `${analytics.topProduct.title} (${analytics.topProduct.total_qty} шт.)`
            : '—';
    } catch (e) {
        showMsg('error', '⚠️ Не удалось загрузить данные дашборда');
    }
}

/* ===================== ТОВАРЫ ===================== */
async function loadProducts() {
    try {
        const data = await api('php/admin_products.php');
        if (!data.ok) { showMsg('error', esc(data.error || 'Ошибка')); return; }
        const tbody = $('#productsTableBody');
        if (!tbody) return;
        if (!data.products.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;">Каталог пуст. Добавьте первый товар.</td></tr>`;
            return;
        }
        tbody.innerHTML = data.products.map(p => `
            <tr>
                <td>${p.id}</td>
                <td>${p.image ? `<div class="admin-thumb"><img src="${esc(p.image)}" alt=""></div>` : `<div class="admin-thumb">нет</div>`}</td>
                <td><strong>${esc(p.title)}</strong></td>
                <td>${esc(p.category)}</td>
                <td>${esc(p.subcategory || '—')}</td>
                <td>${rub(p.price)}</td>
                <td>
                    <button class="btn-edit" data-edit="${p.id}">✏️</button>
                    <button class="btn-delete" data-delete="${p.id}">🗑</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editProduct(b.dataset.edit)));
        tbody.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.delete)));
    } catch (e) {
        showMsg('error', '⚠️ Не удалось загрузить товары');
    }
}

function openAddForm() {
    editingId = null;
    $('#productFormTitle').textContent = 'Добавить товар';
    $('#productForm').reset();
    $('#productId').value = '';
    $('#currentImageNote').textContent = '';
    $('#productForm').scrollIntoView({ behavior: 'smooth' });
}

async function editProduct(id) {
    try {
        const data = await api(`php/admin_products.php?id=${id}`);
        if (!data.ok) { showMsg('error', esc(data.error || 'Ошибка')); return; }
        const p = data.product;
        editingId = p.id;
        $('#productFormTitle').textContent = `Редактировать: ${p.title}`;
        $('#productId').value = p.id;
        $('#pTitle').value = p.title;
        $('#pCategory').value = p.category;
        $('#pSubcategory').value = p.subcategory || '';
        $('#pMaterial').value = p.material || '';
        $('#pPrice').value = p.price;
        $('#pDescription').value = p.description || '';
        $('#currentImageNote').textContent = p.image ? `Текущее фото: ${p.image}` : '';
        $('#productForm').scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
        showMsg('error', '⚠️ Не удалось загрузить товар');
    }
}

async function submitProduct(e) {
    e.preventDefault();
    const form = $('#productForm');
    const fd = new FormData(form);

    if (editingId) {
        fd.append('_method', 'PUT');
        fd.append('id', editingId);
    }

    try {
        const res = await api('php/admin_products.php', { method: 'POST', body: fd });
        if (res.ok) {
            showMsg('success', res.message || 'Сохранено');
            form.reset();
            editingId = null;
            $('#productId').value = '';
            $('#productFormTitle').textContent = 'Добавить товар';
            $('#currentImageNote').textContent = '';
            loadProducts();
        } else {
            showMsg('error', esc(res.error || 'Ошибка сохранения'));
        }
    } catch (err) {
        showMsg('error', '⚠️ Ошибка соединения с сервером');
    }
}

async function deleteProduct(id) {
    if (!confirm('Удалить товар #' + id + '?')) return;
    try {
        const res = await api(`php/admin_products.php?id=${id}`, { method: 'DELETE' });
        if (res.ok) { showMsg('success', res.message); loadProducts(); }
        else showMsg('error', esc(res.error || 'Ошибка удаления'));
    } catch (e) {
        showMsg('error', '⚠️ Ошибка соединения с сервером');
    }
}

/* ===================== АНАЛИТИКА ===================== */
async function loadAnalytics() {
    try {
        const data = await api('php/admin_analytics.php');
        if (!data.ok) { showMsg('error', esc(data.error || 'Ошибка')); return; }
        renderCharts(data);
        const list = $('#topProductsList');
        if (list) {
            list.innerHTML = (data.topProducts || []).map(p => `
                <li><strong>${esc(p.title)}</strong> — ${p.total_qty} шт. (${rub(p.total_revenue)})</li>
            `).join('') || '<li>Нет данных о продажах</li>';
        }
    } catch (e) {
        showMsg('error', '⚠️ Не удалось загрузить аналитику');
    }
}

/* ===================== СМЕНА ПАРОЛЯ ===================== */
async function submitPassword(e) {
    e.preventDefault();
    const form = $('#passwordForm');
    const fd = new FormData(form);
    try {
        const res = await api('php/change_password.php', { method: 'POST', body: fd });
        if (res.ok) { showMsg('success', res.message); form.reset(); }
        else showMsg('error', (res.errors || ['Ошибка']).map(esc).join('<br>'));
    } catch (err) {
        showMsg('error', '⚠️ Ошибка соединения с сервером');
    }
}

function bindStaticForms() {
    $('#productForm')?.addEventListener('submit', submitProduct);
    $('#addProductBtn')?.addEventListener('click', openAddForm);
    $('#passwordForm')?.addEventListener('submit', submitPassword);
    $('#logoutBtn')?.addEventListener('click', async () => {
        await api('php/logout.php', { method: 'POST' });
        window.location.href = 'index.html';
    });

    // Заполняем select категорий
    const sel = $('#pCategory');
    if (sel && !sel.options.length) {
        CATEGORIES.forEach(c => {
            const o = document.createElement('option');
            o.value = c; o.textContent = c;
            sel.appendChild(o);
        });
    }
}
