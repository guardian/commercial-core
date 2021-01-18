import once from 'lodash/once';
import { dfpEnv } from '../dfp/dfp-env';
import { getAdvertById } from '../dfp/get-advert-by-id';
import { loadAdvert, refreshAdvert } from '../dfp/load-advert';

const displayAd = (advertId) => {
	const advert = getAdvertById(advertId);
	if (advert) {
		if (advert.isRendered) {
			refreshAdvert(advert);
		} else {
			loadAdvert(advert);
		}
	}
};

const onIntersect = (entries, observer) => {
	const advertIds = [];

	entries
		.filter((entry) => !('isIntersecting' in entry) || entry.isIntersecting)
		.forEach((entry) => {
			observer.unobserve(entry.target);
			displayAd(entry.target.id);
			advertIds.push(entry.target.id);
		});

	dfpEnv.advertsToLoad = dfpEnv.advertsToLoad.filter(
		(advert) => !advertIds.includes(advert.id),
	);
};

const getObserver = once(() =>
	Promise.resolve(
		new window.IntersectionObserver(onIntersect, {
			rootMargin: '200px 0px',
		}),
	),
);

export const enableLazyLoad = (advert) => {
	if (dfpEnv.lazyLoadObserve) {
		getObserver().then((observer) => observer.observe(advert.node));
	} else {
		displayAd(advert.id);
	}
};