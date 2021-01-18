import config from '@guardian/frontend/static/src/javascripts/lib/config';
import mediator from '@guardian/frontend/static/src/javascripts/lib/mediator';
import reportError from '@guardian/frontend/static/src/javascripts/lib/report-error';
import { markTime } from '@guardian/frontend/static/src/javascripts/lib/user-timing';
import { fire } from '@guardian/frontend/static/src/javascripts/projects/common/modules/analytics/beacon';
import once from 'lodash/once';
import { adSizes } from '../ad-sizes';
import { dfpEnv } from '../dfp/dfp-env';
import { emptyAdvert } from '../dfp/empty-advert';
import { getAdvertById } from '../dfp/get-advert-by-id';
import { renderAdvert } from '../dfp/render-advert';

const recordFirstAdRendered = once(() => {
	markTime('Commercial: First Ad Rendered');
	fire('/count/ad-render.gif');
});

const reportEmptyResponse = (adSlotId, event) => {
	// This empty slot could be caused by a targeting problem,
	// let's report these and diagnose the problem in sentry.
	// Keep the sample rate low, otherwise we'll get rate-limited (report-error will also sample down)
	if (Math.random() < 0.0001) {
		const adUnitPath = event.slot.getAdUnitPath();
		const adTargetingKeys = event.slot.getTargetingKeys();
		const adTargetingKValues = adTargetingKeys.includes('k')
			? event.slot.getTargeting('k')
			: [];
		const adKeywords = adTargetingKValues
			? adTargetingKValues.join(', ')
			: '';

		reportError(
			new Error('dfp returned an empty ad response'),
			{
				feature: 'commercial',
				adUnit: adUnitPath,
				adSlot: adSlotId,
				adKeywords,
			},
			false,
		);
	}
};

const outstreamSizes = [
	adSizes.outstreamDesktop.toString(),
	adSizes.outstreamMobile.toString(),
	adSizes.outstreamGoogleDesktop.toString(),
];

export const onSlotRender = (event) => {
	recordFirstAdRendered();

	const advert = getAdvertById(event.slot.getSlotElementId());
	if (!advert) {
		return;
	}

	const emitRenderEvents = (isRendered) => {
		advert.stopRendering(isRendered);
		mediator.emit('modules:commercial:dfp:rendered', event);
	};

	advert.stopLoading(true);
	advert.startRendering();
	advert.isEmpty = event.isEmpty;

	if (event.isEmpty) {
		emptyAdvert(advert);
		reportEmptyResponse(advert.id, event);
		emitRenderEvents(false);
	} else {
		/**
		 * if advert.hasPrebidSize is false we use size
		 * from the GAM event when adjusting the slot size.
		 * */
		if (!advert.hasPrebidSize) {
			advert.size = event.size;
		}

		if (event.creativeId !== undefined) {
			dfpEnv.creativeIDs.push(event.creativeId);
		}
		// Set refresh field based on the outcome of the slot render.
		const sizeString = advert.size && advert.size.toString();
		const isNotFluid = sizeString !== '0,0';
		const isOutstream = outstreamSizes.includes(sizeString);
		const isNonRefreshableLineItem =
			event.lineItemId &&
			config
				.get('page.dfpNonRefreshableLineItemIds', [])
				.includes(event.lineItemId);

		advert.shouldRefresh =
			isNotFluid &&
			!isOutstream &&
			!config.get('page.hasPageSkin') &&
			!isNonRefreshableLineItem;

		renderAdvert(advert, event).then(emitRenderEvents);
	}
};
