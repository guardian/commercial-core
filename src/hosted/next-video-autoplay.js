import $ from '@guardian/frontend/static/src/javascripts/lib/$';
import { trackNonClickInteraction } from '@guardian/frontend/static/src/javascripts/projects/common/modules/analytics/google';
import bean from 'bean';
import fastdom from 'fastdom';
import { load } from '../hosted/next-video';

let nextVideoInterval;
let $hostedNext;
let $timer;
let nextVideoPage;

const cancelAutoplay = () => {
	fastdom.mutate(() => {
		$hostedNext.addClass('hosted-slide-out');
	});
	clearInterval(nextVideoInterval);
};

const cancelAutoplayMobile = () => {
	fastdom.mutate(() => {
		$hostedNext.addClass('u-h');
	});
};

const triggerAutoplay = (getCurrentTimeFn, duration) => {
	nextVideoInterval = setInterval(() => {
		const timeLeft = duration - Math.ceil(getCurrentTimeFn());
		const countdownLength = 10; // seconds before the end when to show the timer

		if (timeLeft <= countdownLength) {
			fastdom.mutate(() => {
				$hostedNext.addClass('js-autoplay-start');
				$timer.text(`${timeLeft}s`);
			});
		}
		if (timeLeft <= 0) {
			trackNonClickInteraction('Immediately play the next video');
			window.location = nextVideoPage;
		}
	}, 1000);
};

const triggerEndSlate = () => {
	fastdom.mutate(() => {
		$hostedNext.addClass('js-autoplay-start');
	});
	bean.on(document, 'click', $('.js-autoplay-cancel'), () => {
		cancelAutoplayMobile();
	});
};

const addCancelListener = () => {
	bean.on(document, 'click', $('.js-autoplay-cancel'), () => {
		cancelAutoplay();
	});
};

const canAutoplay = () => $hostedNext.length && nextVideoPage;

const init = () =>
	load().then(() => {
		$hostedNext = $('.js-hosted-next-autoplay');
		$timer = $('.js-autoplay-timer');
		nextVideoPage = $timer.length && $timer.data('next-page');
	});

export {
	init,
	canAutoplay,
	triggerEndSlate,
	triggerAutoplay,
	addCancelListener,
};