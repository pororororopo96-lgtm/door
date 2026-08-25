import { products } from '../data/products.js';
import { addToCartSimple } from './cart.js';
import { openProductDetail } from './productDetail.js';

export function initSlider() {
    const track = document.getElementById('sliderTrack');
    if (!track) return;

    const featured = products.filter(p => p.category === 'Межкомнатные двери').slice(0, 4);
    track.innerHTML = featured.map(p => `
        <article class="product-card" data-id="${p.id}">
            <div class="product-image">
                <img src="${p.image}" alt="${p.title}" loading="lazy">
                ${p.variants?.length > 1 ? `<div class="product-variant-count">${p.variants.length} варианта</div>` : ''}
            </div>
            <div class="product-info">
                <div class="product-title">${p.title}</div>
                <div class="product-material">${p.category}</div>
                <div class="product-price">${p.price > 0 ? `${p.price.toLocaleString('ru-RU')} ₽` : 'Цена по запросу'}</div>
                <button class="btn btn-primary" type="button" data-id="${p.id}">В корзину</button>
            </div>
        </article>
    `).join('');

    track.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', e => {
            if (e.target.closest('button')) {
                e.stopPropagation();
                addToCartSimple(Number(card.dataset.id));
                return;
            }
            openProductDetail(Number(card.dataset.id));
        });
    });

    document.getElementById('prevSlide')?.addEventListener('click', () =>
        track.scrollBy({ left: -340, behavior: 'smooth' })
    );
    document.getElementById('nextSlide')?.addEventListener('click', () =>
        track.scrollBy({ left: 340, behavior: 'smooth' })
    );
}
