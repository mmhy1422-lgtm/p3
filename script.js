/* ================= KAZA MIX CORE SCRIPT ================= */

// 1. إعداد اتصال Supabase (إذا كانت القيم غير مفعلة، نستخدم بديل محلي)
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const USE_SUPABASE = SUPABASE_URL && !SUPABASE_URL.includes('YOUR_') && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR_');

async function supabaseRequest(table, method = 'GET', data = null) {
    if (!USE_SUPABASE) {
        if (method === 'POST' && data) {
            const key = `kaza_${table}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.push({ ...data, created_at: new Date().toISOString() });
            localStorage.setItem(key, JSON.stringify(existing));
            return true;
        }
        return [];
    }

    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        };

        if (data) options.body = JSON.stringify(data);

        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, options);
        if (!res.ok) throw new Error('فشل الاتصال بقاعدة البيانات');
        return method === 'GET' ? await res.json() : true;
    } catch (err) {
        console.error('Supabase Error:', err);
        return null;
    }
}

// 2. إدارة السلة
let cart = JSON.parse(localStorage.getItem('kaza_cart')) || [];

function saveCart() {
    localStorage.setItem('kaza_cart', JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    const badge = document.getElementById('cart-badge');
    const itemsContainer = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');

    if (badge) {
        const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        badge.textContent = totalItems;
    }

    if (itemsContainer) {
        if (!cart.length) {
            itemsContainer.innerHTML = '<p class="text-zinc-500 text-center py-8">السلة فارغة حالياً</p>';
        } else {
            itemsContainer.innerHTML = cart.map((item, index) => `
                <div class="flex items-center justify-between bg-zinc-950/40 p-3 rounded-2xl border border-zinc-800">
                    <div>
                        <h4 class="font-bold text-sm text-white">${item.name}</h4>
                        <span class="text-xs text-amber-400">${Number(item.price || 0)} ج.م × ${Number(item.quantity || 0)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="changeQuantity(${index}, 1)" class="w-7 h-7 bg-zinc-800 rounded-lg text-white flex items-center justify-center hover:bg-zinc-700">+</button>
                        <span class="text-sm font-bold">${item.quantity}</span>
                        <button onclick="changeQuantity(${index}, -1)" class="w-7 h-7 bg-zinc-800 rounded-lg text-white flex items-center justify-center hover:bg-zinc-700">-</button>
                    </div>
                </div>
            `).join('');
        }
    }

    const total = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    if (totalElement) totalElement.textContent = total + ' ج.م';
}

function changeQuantity(index, delta) {
    if (!cart[index]) return;
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    saveCart();
}

function toggleCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer && overlay) {
        drawer.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
    }
}

// 3. المودال والتفاصيل
let currentProduct = null;

function openProductModal(name, price, desc, img) {
    currentProduct = { name, price: Number(price), description: desc, image: img };
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');
    const modalBasePrice = document.getElementById('modal-base-price');
    const modalImg = document.getElementById('modal-img');

    if (modalTitle) modalTitle.textContent = name;
    if (modalDesc) modalDesc.textContent = desc;
    if (modalBasePrice) modalBasePrice.textContent = price + ' ج.م';
    if (modalImg) modalImg.src = img;

    document.querySelectorAll('input[name="addon"]').forEach((el) => {
        el.checked = false;
    });
    calculateModalTotal();

    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-content');
    if (modal && content) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
}

async function loadOffers() {
    const offersList = document.getElementById('offers-list');
    if (!offersList) return;

    offersList.replaceChildren();
    try {
        const response = await fetch('/api/offers');
        if (!response.ok) throw new Error('تعذر تحميل العروض');
        const offers = await response.json();

        if (!offers.length) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'col-span-full py-8 text-center text-sm text-zinc-400';
            emptyMessage.textContent = 'لا توجد عروض حالياً';
            offersList.appendChild(emptyMessage);
            return;
        }

        offers.forEach((offer, index) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'w-full cursor-pointer text-right relative rounded-xl sm:rounded-3xl overflow-hidden border border-zinc-700/60 shadow-xl group bg-zinc-900/50 hover:border-amber-500/60 transition-all duration-300 flex flex-col justify-between';
            card.innerHTML = `
                <div class="w-full text-right">
                    <div class="h-28 sm:h-60 overflow-hidden relative">
                        <img data-offer-image alt="عرض" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                        <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"></div>
                        <span data-offer-badge class="absolute top-2 right-2 sm:top-4 sm:right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-black text-[9px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg"></span>
                    </div>
                    <div class="p-2.5 sm:p-6 space-y-1 sm:space-y-2">
                        <span data-offer-number class="text-amber-400 text-[9px] sm:text-xs font-bold"></span>
                        <h3 data-offer-title class="text-white font-black text-xs sm:text-xl"></h3>
                        <p data-offer-description class="text-zinc-300 text-[11px] sm:text-sm"></p>
                    </div>
                </div>
                <div class="w-full p-2.5 sm:p-6 pt-0 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <span data-offer-price class="text-xs sm:text-2xl font-black bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent"></span>
                    <span class="text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-xl font-bold">التفاصيل</span>
                </div>`;

            const image = card.querySelector('[data-offer-image]');
            image.src = offer.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80';
            card.querySelector('[data-offer-badge]').textContent = offer.badge || 'عرض مميز';
            card.querySelector('[data-offer-number]').textContent = `العرض ${new Intl.NumberFormat('ar-EG').format(index + 1)}`;
            card.querySelector('[data-offer-title]').textContent = offer.title;
            card.querySelector('[data-offer-description]').textContent = offer.description;
            card.querySelector('[data-offer-price]').textContent = `${new Intl.NumberFormat('ar-EG').format(Number(offer.price) || 0)} ج.م`;
            card.addEventListener('click', () => openProductModal(offer.title, offer.price, offer.description, image.src));
            offersList.appendChild(card);
        });
    } catch (error) {
        const errorMessage = document.createElement('p');
        errorMessage.className = 'col-span-full py-8 text-center text-sm text-red-300';
        errorMessage.textContent = error.message || 'تعذر تحميل العروض';
        offersList.appendChild(errorMessage);
    }
}

async function loadMenu() {
    const menuGrid = document.getElementById('menu-grid');
    if (!menuGrid) return;

    menuGrid.replaceChildren();
    try {
        const response = await fetch('/api/menu');
        if (!response.ok) throw new Error('تعذر تحميل المنيو');
        const menuItems = await response.json();

        if (!menuItems.length) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'col-span-full py-8 text-center text-sm text-zinc-400';
            emptyMessage.textContent = 'المنيو فارغ حالياً';
            menuGrid.appendChild(emptyMessage);
            return;
        }

        menuItems.forEach((item, index) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'cursor-pointer text-right bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-xl sm:rounded-3xl overflow-hidden hover:border-amber-500/50 transition-all duration-300 flex flex-col justify-between group';
            card.innerHTML = `
                <div class="w-full">
                    <div class="h-28 sm:h-52 overflow-hidden relative">
                        <img data-menu-image alt="وجبة" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                        <span data-menu-badge class="hidden absolute top-2 right-2 sm:top-4 sm:right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-extrabold text-[9px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg"></span>
                    </div>
                    <div class="p-2.5 sm:p-6 space-y-1 sm:space-y-3">
                        <h3 data-menu-name class="text-xs sm:text-xl font-bold text-white group-hover:text-amber-400 transition"></h3>
                        <p data-menu-description class="text-zinc-300 text-[11px] sm:text-sm"></p>
                    </div>
                </div>
                <div class="w-full p-2.5 sm:p-6 pt-0 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <span data-menu-price class="text-xs sm:text-2xl font-black bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent"></span>
                    <span class="text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-xl font-bold">التفاصيل</span>
                </div>`;

            const image = card.querySelector('[data-menu-image]');
            image.src = item.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80';
            image.alt = item.name;
            const badge = card.querySelector('[data-menu-badge]');
            if (item.badge) {
                badge.textContent = item.badge;
                badge.classList.remove('hidden');
            }
            card.querySelector('[data-menu-name]').textContent = `${new Intl.NumberFormat('ar-EG').format(index + 1)}. ${item.name}`;
            card.querySelector('[data-menu-description]').textContent = item.description;
            card.querySelector('[data-menu-price]').textContent = `${new Intl.NumberFormat('ar-EG').format(Number(item.price) || 0)} ج.م`;
            card.addEventListener('click', () => openProductModal(item.name, item.price, item.description, image.src));
            menuGrid.appendChild(card);
        });
    } catch (error) {
        const errorMessage = document.createElement('p');
        errorMessage.className = 'col-span-full py-8 text-center text-sm text-red-300';
        errorMessage.textContent = error.message || 'تعذر تحميل المنيو';
        menuGrid.appendChild(errorMessage);
    }
}

const orderStatusLabels = {
    received: 'تم استلام الطلب',
    preparing: 'قيد التحضير',
    ready: 'جاهز للتوصيل',
    delivered: 'تم التسليم',
    cancelled: 'ملغي'
};

async function loadUserOrders() {
    const ordersList = document.getElementById('user-orders');
    if (!ordersList) return;

    ordersList.replaceChildren();
    const token = localStorage.getItem('authToken');
    if (!token) {
        const message = document.createElement('p');
        message.className = 'text-sm text-zinc-400';
        message.textContent = 'سجّل الدخول مرة أخرى لعرض طلباتك.';
        ordersList.appendChild(message);
        return;
    }

    try {
        const response = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
        const orders = await response.json();
        if (!response.ok) throw new Error(orders.message || 'تعذر تحميل طلباتك');
        if (!orders.length) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'text-sm text-zinc-400';
            emptyMessage.textContent = 'لا توجد طلبات مرتبطة بحسابك حتى الآن';
            ordersList.appendChild(emptyMessage);
            return;
        }

        orders.slice().reverse().forEach((order) => {
            const card = document.createElement('article');
            card.className = 'rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-3';
            const heading = document.createElement('div');
            heading.className = 'flex flex-wrap items-center justify-between gap-2';
            const id = document.createElement('h3');
            id.className = 'font-bold text-white';
            id.textContent = order.id;
            const status = document.createElement('span');
            status.className = 'rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300';
            status.textContent = orderStatusLabels[order.status] || orderStatusLabels.received;
            heading.append(id, status);

            const items = document.createElement('p');
            items.className = 'text-sm text-zinc-300';
            items.textContent = (order.items || []).map((item) => `${item.name} × ${item.quantity}`).join('، ');
            const details = document.createElement('p');
            details.className = 'text-xs text-zinc-400';
            details.textContent = `${order.address} · ${order.payment_method || 'كاش'} · ${new Date(order.updated_at || order.created_at).toLocaleString('ar-EG')}`;
            const total = document.createElement('p');
            total.className = 'text-sm font-black text-amber-300';
            total.textContent = `${new Intl.NumberFormat('ar-EG').format(Number(order.total_price) || 0)} ج.م`;
            card.append(heading, items, details, total);
            ordersList.appendChild(card);
        });
    } catch (error) {
        const errorMessage = document.createElement('p');
        errorMessage.className = 'text-sm text-red-300';
        errorMessage.textContent = error.message || 'تعذر تحميل طلباتك';
        ordersList.appendChild(errorMessage);
    }
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function calculateModalTotal() {
    if (!currentProduct) return;
    let total = currentProduct.price;
    document.querySelectorAll('input[name="addon"]:checked').forEach((el) => {
        total += Number(el.getAttribute('data-price') || 0);
    });

    const totalEl = document.getElementById('modal-total-price');
    if (totalEl) totalEl.textContent = total + ' ج.م';
}

function addModalItemToCart() {
    if (!currentProduct) return;

    let finalPrice = currentProduct.price;
    const selectedAddons = [];

    document.querySelectorAll('input[name="addon"]:checked').forEach((el) => {
        finalPrice += Number(el.getAttribute('data-price') || 0);
        selectedAddons.push(el.value);
    });

    const itemName = selectedAddons.length ? `${currentProduct.name} (${selectedAddons.join(', ')})` : currentProduct.name;
    const existing = cart.find((item) => item.name === itemName);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ name: itemName, price: finalPrice, quantity: 1 });
    }

    saveCart();
    closeProductModal();
    showToast('تمت الإضافة', 'تمت إضافة الوجبة بنجاح إلى السلة');
}

// 4. إتمام الطلب والدفع
function checkout() {
    if (!cart.length) {
        showToast('السلة فارغة', 'أضف بعض الوجبات أولاً قبل إتمام الطلب', 'error');
        return;
    }

    toggleCart();
    const modal = document.getElementById('checkout-modal');
    const content = document.getElementById('checkout-modal-content');
    const total = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);

    const totalEl = document.getElementById('checkout-total-price');
    if (totalEl) totalEl.textContent = total + ' ج.م';

    if (modal && content) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);
    }
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    const content = document.getElementById('checkout-modal-content');
    if (!modal || !content) return;

    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function togglePaymentFields(method) {
    const paymentRadios = document.querySelectorAll('input[name="payment"]');
    paymentRadios.forEach((radio) => {
        radio.checked = radio.value === method || (method === 'cash' && radio.value === 'كاش') || (method === 'visa' && radio.value === 'فيزا') || (method === 'wallet' && radio.value === 'محفظة إلكترونية');
    });

    const visaDetails = document.getElementById('visa-details');
    const walletDetails = document.getElementById('wallet-details');
    const visaArrow = document.getElementById('visa-arrow');
    const walletArrow = document.getElementById('wallet-arrow');

    if (visaDetails) {
        visaDetails.classList.toggle('hidden', method !== 'visa');
    }
    if (walletDetails) {
        walletDetails.classList.toggle('hidden', method !== 'wallet');
    }
    if (visaArrow) {
        visaArrow.style.transform = method === 'visa' ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    if (walletArrow) {
        walletArrow.style.transform = method === 'wallet' ? 'rotate(180deg)' : 'rotate(0deg)';
    }
}

function autoDetectLocation() {
    const addressField = document.getElementById('checkout-address');
    if (!addressField) return;

    if (!navigator.geolocation) {
        addressField.value = 'المدينة - الحي - رقم المبنى';
        showToast('موقع غير متاح', 'تمت تهيئة العنوان يدويًا', 'warning');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
            addressField.value = `الإحداثيات: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} - الموقع الحالي`;
            showToast('تم التحديد', 'تم تحديد موقعك تلقائيًا بنجاح');
        },
        () => {
            addressField.value = 'المدينة - الحي - رقم المبنى';
            showToast('فشل التحديد', 'اكتب العنوان يدويًا إذا رغبت', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

async function submitOrder() {
    const name = document.getElementById('checkout-name').value.trim();
    const phone = document.getElementById('checkout-phone').value.trim();
    const address = document.getElementById('checkout-address').value.trim();
    const selected = document.querySelector('input[name="payment"]:checked');
    const payment = selected ? selected.value : 'كاش';

    if (!name || !phone || !address) {
        alert('من فضلك أكمل بيانات التوصيل (الاسم، الهاتف، العنوان)');
        return;
    }

    const total = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    const orderData = {
        customer_name: name,
        phone,
        address,
        payment_method: payment,
        total_price: total,
        items: cart
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`
            },
            body: JSON.stringify(orderData)
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'تعذر إرسال الطلب');

        closeCheckoutModal();

        document.getElementById('success-name').textContent = name;
        document.getElementById('success-payment').textContent = payment;
        document.getElementById('success-total').textContent = result.order.total_price + ' ج.م';
        document.getElementById('success-order-id').textContent = result.order.id;

        const successModal = document.getElementById('success-modal');
        if (successModal) successModal.classList.remove('hidden');

        cart = [];
        saveCart();
        await loadUserOrders();
    } catch (error) {
        alert(error.message || 'حدث خطأ أثناء إرسال الطلب، تأكد من اتصال الإنترنت.');
    }
}

function showToast(title, msg, type = 'success') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast || !toastTitle || !toastMsg || !toastIcon) return;

    toastTitle.textContent = title;
    toastMsg.textContent = msg;
    toastIcon.innerHTML = type === 'error' ? '<i class="fa-solid fa-xmark"></i>' : type === 'warning' ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-check"></i>';
    toastIcon.className = `w-8 h-8 rounded-full flex items-center justify-center ${type === 'error' ? 'bg-red-500/20 text-red-400' : type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-amber-500/20 text-amber-400'}`;

    toast.classList.remove('translate-y-32', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-32', 'opacity-0');
    }, 3000);
}

function closeSuccessModalAndGoHome() {
    const successModal = document.getElementById('success-modal');
    if (successModal) successModal.classList.add('hidden');
    window.location.href = 'index.html';
}

function triggerDownload() {
    const button = document.getElementById('download-pdf-btn');
    const textEl = document.getElementById('dl-text');
    const iconEl = document.getElementById('dl-icon');

    if (button && textEl) {
        textEl.textContent = 'جارٍ تجهيز المنيو...';
        button.disabled = true;
    }

    const menuItems = [
        'BurgerCraft Menu',
        '================',
        '1. دابل سماش برجر - 160 ج.م',
        '2. كريسبي تشيكن برجر - 145 ج.م',
        '3. لوديد فرايز بالجبنة - 75 ج.م',
        '4. تريبل كرافت برجر - 190 ج.م',
        '5. بيكون سماش برجر - 175 ج.م',
        '6. تشيز برجر كلاسيك - 130 ج.م',
        '7. ميكسد جريل برجر - 185 ج.م',
        '8. سبايسي هالبينو برجر - 155 ج.م',
        '9. مشوي فحم سوبر برجر - 165 ج.م',
        '10. تشيكن رانش برجر - 140 ج.م'
    ].join('\n');

    const blob = new Blob([menuItems], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'BurgerCraft-Menu.html';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    if (button && textEl) {
        textEl.textContent = 'تم تحميل المنيو';
        if (iconEl) iconEl.className = 'fa-solid fa-check';
        setTimeout(() => {
            textEl.textContent = 'تحميل المنيو PDF';
            if (iconEl) iconEl.className = 'fa-solid fa-download';
            button.disabled = false;
        }, 1500);
    }
}

async function addMenuItem(e) {
    e.preventDefault();
    const item = {
        name: document.getElementById('menu-name').value,
        price: parseFloat(document.getElementById('menu-price').value),
        description: document.getElementById('menu-desc').value,
        image: document.getElementById('menu-img').value
    };

    const res = await supabaseRequest('menu_items', 'POST', item);
    if (res !== null) {
        alert('تمت إضافة العنصر للمنيو بنجاح!');
        document.getElementById('menu-form').reset();
    } else {
        alert('حدث خطأ أثناء إضافة العنصر');
    }
}

async function addOfferItem(e) {
    e.preventDefault();
    const offer = {
        title: document.getElementById('offer-title').value,
        description: document.getElementById('offer-desc').value
    };

    const res = await supabaseRequest('offers', 'POST', offer);
    if (res !== null) {
        alert('تمت إضافة العرض بنجاح!');
        document.getElementById('offer-form').reset();
    } else {
        alert('حدث خطأ أثناء إضافة العرض');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userEmail', email);
    window.location.href = 'index.html';
}

// 5. التهيئة عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
    loadMenu();
    loadOffers();
    loadUserOrders();

    document.querySelectorAll('.reveal').forEach((el) => {
        el.classList.add('active');
    });

    const cursor = document.querySelector('.custom-cursor');
    const follower = document.querySelector('.custom-cursor-follower');

    if (cursor && follower) {
        window.addEventListener('mousemove', (event) => {
            const posX = event.clientX;
            const posY = event.clientY;
            cursor.style.left = `${posX}px`;
            cursor.style.top = `${posY}px`;
            follower.style.left = `${posX}px`;
            follower.style.top = `${posY}px`;
        });
    }

    const paymentInputs = document.querySelectorAll('input[name="payment"]');
    paymentInputs.forEach((input) => {
        input.addEventListener('change', () => {
            togglePaymentFields(input.value === 'كاش' ? 'cash' : input.value === 'فيزا' ? 'visa' : 'wallet');
        });
    });

    togglePaymentFields('cash');
});