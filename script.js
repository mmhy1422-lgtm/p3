// script.js - BurgerCraft Project

let cart = [];
let currentProduct = { name: '', basePrice: 0, desc: '', img: '' };

// 1. Force Scroll to Top on Page Refresh (Prevent browser scroll restoration)
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

window.addEventListener('load', () => {
    window.scrollTo(0, 0);
});

// Custom Mouse Cursor Movement Logic (Disabled automatically on touch devices via CSS)
document.addEventListener('mousemove', (e) => {
    const cursor = document.querySelector('.custom-cursor');
    const follower = document.querySelector('.custom-cursor-follower');
    if (cursor && follower) {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
        
        setTimeout(() => {
            follower.style.left = `${e.clientX}px`;
            follower.style.top = `${e.clientY}px`;
        }, 30);
    }
});

// Open Product Details Modal
function openProductModal(name, price, desc, img) {
    currentProduct = { name, basePrice: price, desc, img };
    
    document.getElementById('modal-title').innerText = name;
    document.getElementById('modal-desc').innerText = desc;
    document.getElementById('modal-base-price').innerText = price + ' ج.م';
    document.getElementById('modal-img').src = img;

    document.querySelectorAll('input[name="addon"]').forEach(cb => cb.checked = false);
    calculateModalTotal();

    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-content');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

// Close Product Details Modal
function closeProductModal() {
    const modal = document.getElementById('product-modal');
    const content = document.getElementById('modal-content');
    
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

// Calculate Modal Total with Add-ons
function calculateModalTotal() {
    let total = currentProduct.basePrice;
    document.querySelectorAll('input[name="addon"]:checked').forEach(cb => {
        total += parseInt(cb.getAttribute('data-price'));
    });
    document.getElementById('modal-total-price').innerText = total + ' ج.م';
}

// Add Item with Add-ons to Cart from Modal
function addModalItemToCart() {
    let finalName = currentProduct.name;
    let finalPrice = currentProduct.basePrice;
    let addonsList = [];

    document.querySelectorAll('input[name="addon"]:checked').forEach(cb => {
        addonsList.push(cb.value);
        finalPrice += parseInt(cb.getAttribute('data-price'));
    });

    if (addonsList.length > 0) {
        finalName += ` (إضافات: ${addonsList.join(', ')})`;
    }

    cart.push({ name: finalName, price: finalPrice });
    updateCart();
    showToast("تمت الإضافة", `تمت إضافة "${finalName}" للسلة بنجاح`, "success");
    closeProductModal();
}

// Toggle Shopping Cart Drawer
function toggleCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer && overlay) {
        drawer.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
    }
}

// Update Cart UI & Total
function updateCart() {
    const container = document.getElementById('cart-items');
    const badge = document.getElementById('cart-badge');
    const totalEl = document.getElementById('cart-total');

    if (!container || !badge || !totalEl) return;

    badge.innerText = cart.length;

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-zinc-500 text-center py-8">السلة فارغة حالياً</p>';
        totalEl.innerText = '٠ ج.م';
        return;
    }

    container.innerHTML = '';
    let total = 0;
    cart.forEach((item, index) => {
        total += item.price;
        container.innerHTML += `
            <div class="flex justify-between items-center bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50">
                <div>
                    <h5 class="font-bold text-sm text-white">${item.name}</h5>
                    <span class="text-amber-400 text-xs">${item.price} ج.م</span>
                </div>
                <button onclick="removeFromCart(${index})" class="text-red-400 hover:text-red-300 text-sm cursor-pointer"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
    totalEl.innerText = total + ' ج.م';
}

// Remove Item from Cart
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCart();
}

// Professional Toast Notification System
function showToast(title, message, type = "success") {
    const toast = document.getElementById('toast');
    const titleEl = document.getElementById('toast-title');
    const msgEl = document.getElementById('toast-msg');
    const iconContainer = document.getElementById('toast-icon');
    
    if (!toast || !msgEl) return;

    titleEl.innerText = title;
    msgEl.innerText = message;

    if (type === "warning") {
        iconContainer.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-amber-400"></i>';
        iconContainer.className = "w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center";
    } else {
        iconContainer.innerHTML = '<i class="fa-solid fa-check text-amber-400"></i>';
        iconContainer.className = "w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center";
    }

    toast.classList.remove('translate-y-32', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-32', 'opacity-0');
    }, 3500);
}

// Checkout Button Clicked: Open Checkout Modal (With Professional Empty Cart Warning)
function checkout() {
    if (cart.length === 0) {
        toggleCart(); // قفل السلة
        showToast("تنبيه هام", "السلة فارغة حالياً! من فضلك اختر وجبتك المفضلة أولاً.", "warning");
        return;
    }

    let total = cart.reduce((sum, item) => sum + item.price, 0);
    document.getElementById('checkout-total-price').innerText = total + ' ج.م';

    toggleCart();

    const modal = document.getElementById('checkout-modal');
    const content = document.getElementById('checkout-modal-content');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

// Close Checkout Modal
function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    const content = document.getElementById('checkout-modal-content');
    
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

// Toggle Payment Fields Accordion (Visa / Wallet / Cash)
function togglePaymentFields(type) {
    const visaDetails = document.getElementById('visa-details');
    const walletDetails = document.getElementById('wallet-details');
    const visaArrow = document.getElementById('visa-arrow');
    const walletArrow = document.getElementById('wallet-arrow');
    
    const cashRadio = document.getElementById('cash-radio');
    const visaRadio = document.getElementById('visa-radio');
    const walletRadio = document.getElementById('wallet-radio');

    if (type === 'visa') {
        visaDetails.classList.toggle('hidden');
        walletDetails.classList.add('hidden');
        visaArrow.classList.toggle('rotate-180');
        walletArrow.classList.remove('rotate-180');
        visaRadio.checked = true;
    } else if (type === 'wallet') {
        walletDetails.classList.toggle('hidden');
        visaDetails.classList.add('hidden');
        walletArrow.classList.toggle('rotate-180');
        visaArrow.classList.remove('rotate-180');
        walletRadio.checked = true;
    } else {
        visaDetails.classList.add('hidden');
        walletDetails.classList.add('hidden');
        visaArrow.classList.remove('rotate-180');
        walletArrow.classList.remove('rotate-180');
        cashRadio.checked = true;
    }
}

// Auto Detect Location using HTML5 Geolocation API
function autoDetectLocation() {
    const addressInput = document.getElementById('checkout-address');
    if (navigator.geolocation) {
        addressInput.value = "جاري تحديد موقعك الحالي عبر الأقمار الصناعية...";
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            addressInput.value = `الموقع الحالي (خط العرض: ${lat.toFixed(4)}, خط الطول: ${lon.toFixed(4)})`;
        }, (error) => {
            alert("تعذر تحديد الموقع تلقائياً، يرجى كتابة العنوان يدوياً.");
            addressInput.value = "";
        });
    } else {
        alert("خاصية تحديد الموقع غير مدعومة في متصفحك.");
    }
}

// Submit Order Function & Open Stunning Success Modal
function submitOrder() {
    const name = document.getElementById('checkout-name').value.trim();
    const phone = document.getElementById('checkout-phone').value.trim();
    const address = document.getElementById('checkout-address').value.trim();
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

    if (!name || !phone || !address) {
        alert("من فضلك أدخل الاسم، رقم الهاتف، وعنوان التوصيل كاملاً!");
        return;
    }

    let total = cart.reduce((sum, item) => sum + item.price, 0);

    // Populate Success Modal Details
    document.getElementById('success-order-id').innerText = '#BC-' + Math.floor(1000 + Math.random() * 9000);
    document.getElementById('success-name').innerText = name;
    document.getElementById('success-payment').innerText = paymentMethod;
    document.getElementById('success-total').innerText = total + ' ج.م';

    closeCheckoutModal();

    const successModal = document.getElementById('success-modal');
    const successContent = document.getElementById('success-modal-content');
    
    successModal.classList.remove('hidden');
    setTimeout(() => {
        successContent.classList.remove('scale-95', 'opacity-0');
        successContent.classList.add('scale-100', 'opacity-100');
    }, 10);

    cart = [];
    updateCart();
}

// Close Success Modal and Smooth Scroll back to Homepage
function closeSuccessModalAndGoHome() {
    const successModal = document.getElementById('success-modal');
    const successContent = document.getElementById('success-modal-content');
    
    successContent.classList.remove('scale-100', 'opacity-100');
    successContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        successModal.classList.add('hidden');
    }, 200);

    const heroSection = document.getElementById('hero');
    if (heroSection) {
        heroSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Scroll Effects, Scroll Spy & Reveal Animations
document.addEventListener("DOMContentLoaded", function() {
    window.scrollTo(0, 0); // تأكيد إضافي للرجوع لأول الصفحة

    const logo = document.getElementById('floating-logo');
    const reveals = document.querySelectorAll('.reveal');
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');
    
    function handleScroll() {
        if (logo) {
            if (window.scrollY > 40) {
                logo.classList.add('opacity-0', 'pointer-events-none', '-translate-y-10');
            } else {
                logo.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-10');
            }
        }

        reveals.forEach(element => {
            const windowHeight = window.innerHeight;
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 80;
            
            if (elementTop < windowHeight - elementVisible) {
                element.classList.add('active');
            }
        });

        let currentSection = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.scrollY >= (sectionTop - 250)) {
                currentSection = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('text-amber-400', 'bg-zinc-800/85');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('text-amber-400', 'bg-zinc-800/85');
            }
        });
    }

    window.addEventListener('scroll', handleScroll);
    handleScroll();
});

// PDF Download Button Animation
function triggerDownload() {
    const btn = document.getElementById('download-pdf-btn');
    const icon = document.getElementById('dl-icon');
    const text = document.getElementById('dl-text');
    
    if (!btn || btn.classList.contains('completed')) return;

    btn.classList.add('opacity-90', 'scale-95');
    if (icon) icon.className = "fa-solid fa-spinner fa-spin";
    if (text) text.innerText = "جاري التحميل...";

    setTimeout(() => {
        btn.classList.remove('from-purple-600', 'to-indigo-600', 'opacity-90', 'scale-95');
        btn.classList.add('bg-emerald-600', 'completed');
        if (icon) icon.className = "fa-solid fa-check";
        if (text) text.innerText = "Completed";

        setTimeout(() => {
            const link = document.createElement('a');
            link.href = '#';
            link.setAttribute('download', 'BurgerCraft-Menu.pdf');
            document.body.appendChild(link);
        }, 500);

    }, 1500);
}