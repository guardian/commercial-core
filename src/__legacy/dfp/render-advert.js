import config from '@guardian/frontend/static/src/javascripts/lib/config';
import fastdom from '@guardian/frontend/static/src/javascripts/lib/fastdom-promise';
import reportError from '@guardian/frontend/static/src/javascripts/lib/report-error';
import { geoMostPopular } from '@guardian/frontend/static/src/javascripts/projects/common/modules/onward/geo-most-popular';
import qwery from 'qwery';
import { adSizes } from '../ad-sizes';
import { applyCreativeTemplate } from '../dfp/apply-creative-template';
import { renderAdvertLabel } from '../dfp/render-advert-label';
import { stickyCommentsMpu, stickyMpu } from '../sticky-mpu';
/**
 * ADVERT RENDERING
 * ----------------
 *
 * Most adverts come back from DFP ready to display as-is. But sometimes we need more: embedded components that can share
 * Guardian styles, for example, or behaviours like sticky-scrolling. This module helps 'finish' rendering any advert, and
 * decorates them with these behaviours.
 *
 */

const addClassIfHasClass = (newClassNames) =>
	function hasClass(classNames) {
		return function onAdvertRendered(_, advert) {
			if (
				classNames.some((className) =>
					advert.node.classList.contains(className),
				)
			) {
				return fastdom.mutate(() => {
					newClassNames.forEach((className) => {
						advert.node.classList.add(className);
					});
					// Add fluid styles from _adslot.scss
					// mark: 9473ae05-a901-4a8d-a51d-1b9c894d6e1f
					if (
						config.get('isDotcomRendering', false) &&
						newClassNames.includes('ad-slot--fluid')
					) {
						advert.node.style.minHeight = '250px';
						advert.node.style.lineHeight = '10px';
						advert.node.style.padding = '0';
						advert.node.style.margin = '0';
						if (
							!newClassNames.includes('ad-slot--im') &&
							!newClassNames.includes('ad-slot--carrot') &&
							!newClassNames.includes('ad-slot--offset-right')
						)
							advert.node.style.width = '100%';
					}
				});
			}
			return Promise.resolve();
		};
	};

const addFluid250 = addClassIfHasClass(['ad-slot--fluid250']);
const addFluid = addClassIfHasClass(['ad-slot--fluid']);

const removeStyleFromAdIframe = (advert, style) => {
	const adIframe = advert.node.querySelector('iframe');

	fastdom.mutate(() => {
		if (adIframe) {
			adIframe.style.removeProperty(style);
		}
	});
};

const sizeCallbacks = {};

/**
 * DFP fluid ads should use existing fluid-250 styles in the top banner position
 * The vertical-align property found on DFP iframes affects the smoothness of
 * CSS transitions when expanding/collapsing various native style formats.
 */
sizeCallbacks[adSizes.fluid] = (renderSlotEvent, advert) =>
	addFluid(['ad-slot'])(renderSlotEvent, advert).then(() =>
		removeStyleFromAdIframe(advert, 'vertical-align'),
	);

/**
 * Trigger sticky scrolling for MPUs in the right-hand article column
 */
sizeCallbacks[adSizes.mpu] = (_, advert) =>
	fastdom.measure(() => {
		if (advert.node.classList.contains('js-sticky-mpu')) {
			if (advert.node.classList.contains('ad-slot--right')) {
				stickyMpu(advert.node);
			}
			if (advert.node.classList.contains('ad-slot--comments')) {
				stickyCommentsMpu(advert.node);
			}
		}
		return fastdom.mutate(() => advert.updateExtraSlotClasses());
	});

/**
 * Resolve the stickyMpu.whenRendered promise
 */
sizeCallbacks[adSizes.halfPage] = (_, advert) =>
	fastdom.measure(() => {
		if (advert.node.classList.contains('ad-slot--right')) {
			stickyMpu(advert.node);
		}
		if (advert.node.classList.contains('ad-slot--comments')) {
			stickyCommentsMpu(advert.node);
		}
		return fastdom.mutate(() => advert.updateExtraSlotClasses());
	});

sizeCallbacks[adSizes.skyscraper] = (_, advert) =>
	fastdom.measure(() => {
		if (advert.node.classList.contains('ad-slot--right')) {
			stickyMpu(advert.node);
		}
		if (advert.node.classList.contains('ad-slot--comments')) {
			stickyCommentsMpu(advert.node);
		}
		return fastdom.mutate(() =>
			advert.updateExtraSlotClasses('ad-slot--sky'),
		);
	});

sizeCallbacks[adSizes.video] = (_, advert) =>
	fastdom.mutate(() => {
		advert.updateExtraSlotClasses('u-h');
	});

sizeCallbacks[adSizes.outstreamDesktop] = (_, advert) =>
	fastdom.mutate(() => {
		advert.updateExtraSlotClasses('ad-slot--outstream');
	});

sizeCallbacks[adSizes.outstreamGoogleDesktop] = (_, advert) =>
	fastdom.mutate(() => {
		advert.updateExtraSlotClasses('ad-slot--outstream');
	});

sizeCallbacks[adSizes.outstreamMobile] = (_, advert) =>
	fastdom.mutate(() => {
		advert.updateExtraSlotClasses('ad-slot--outstream');
	});

sizeCallbacks[adSizes.googleCard] = (_, advert) =>
	fastdom.mutate(() => {
		advert.updateExtraSlotClasses('ad-slot--gc');
	});

/**
 * Out of page adverts - creatives that aren't directly shown on the page - need to be hidden,
 * and their containers closed up.
 */
const outOfPageCallback = (event, advert) => {
	if (!event.slot.getOutOfPage()) {
		const parent = advert.node.parentNode;
		return fastdom.mutate(() => {
			advert.node.classList.add('u-h');
			// if in a slice, add the 'no mpu' class
			if (parent.classList.contains('fc-slice__item--mpu-candidate')) {
				parent.classList.add('fc-slice__item--no-mpu');
			}
		});
	}
	return Promise.resolve();
};
sizeCallbacks[adSizes.outOfPage] = outOfPageCallback;
sizeCallbacks[adSizes.empty] = outOfPageCallback;

/**
 * Portrait adverts exclude the locally-most-popular widget
 */
sizeCallbacks[adSizes.portrait] = () =>
	// remove geo most popular
	geoMostPopular.whenRendered.then((popular) =>
		fastdom.mutate(() => {
			if (popular && popular.elem) {
				popular.elem.remove();
				popular.elem = null;
			}
		}),
	);

/**
 * Commercial components with merch sizing get fluid-250 styling
 */
sizeCallbacks[adSizes.merchandising] = addFluid250([
	'ad-slot--commercial-component',
]);

const addContentClass = (adSlotNode) => {
	const adSlotContent = qwery('> div:not(.ad-slot__label)', adSlotNode);

	if (adSlotContent.length) {
		fastdom.mutate(() => {
			adSlotContent[0].classList.add('ad-slot__content');
		});
	}
};

/**
 * @param advert - as defined in commercial/modules/dfp/Advert
 * @param slotRenderEndedEvent - GPT slotRenderEndedEvent
 * @returns {Promise} - resolves once all necessary rendering is queued up
 */
export const renderAdvert = (advert, slotRenderEndedEvent) => {
	addContentClass(advert.node);

	return applyCreativeTemplate(advert.node)
		.then((isRendered) => {
			const callSizeCallback = () => {
				if (advert.size) {
					let size = advert.size.toString();

					if (size === '0,0') {
						size = 'fluid';
					}

					/**
					 * we reset hasPrebidSize to the default
					 * value of false for subsequent ad refreshes
					 * as they may not be prebid ads.
					 * */
					advert.hasPrebidSize = false;

					return Promise.resolve(
						sizeCallbacks[size]
							? sizeCallbacks[size](slotRenderEndedEvent, advert)
							: fastdom.mutate(() => {
									advert.updateExtraSlotClasses();
							  }),
					);
				}
				return Promise.resolve(null);
			};

			const addRenderedClass = () =>
				isRendered
					? fastdom.mutate(() => {
							advert.node.classList.add('ad-slot--rendered');
					  })
					: Promise.resolve();

			return callSizeCallback()
				.then(() => renderAdvertLabel(advert.node))
				.then(addRenderedClass)
				.then(() => isRendered);
		})
		.catch((err) => {
			reportError(
				err,
				{
					feature: 'commercial',
				},
				false,
			);

			return Promise.resolve(false);
		});
};
