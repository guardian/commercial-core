import $ from '@guardian/frontend/static/src/javascripts/lib/$';
import { isAndroid } from '@guardian/frontend/static/src/javascripts/lib/detect';
import mediator from '@guardian/frontend/static/src/javascripts/lib/mediator';
import fastdom from 'fastdom';
import { addTrackingPixel } from '../creatives/add-tracking-pixel';
import { addViewabilityTracker } from '../creatives/add-viewability-tracker';

/**
 * TODO: rather blunt instrument this, due to the fact *most* mobile devices don't have a fixed
 * background-attachment - need to make this more granular
 */
const hasScrollEnabled = !isAndroid();

/**
 * https://www.google.com/dfp/59666047#delivery/CreateCreativeTemplate/creativeTemplateId=10026567
 * https://www.google.com/dfp/59666047#delivery/CreateCreativeTemplate/creativeTemplateId=10037607
 */

const scrollableMpuTpl = (params) => `
<a id="${params.id}" class="creative--scrollable-mpu"
    href="${params.clickMacro}${params.destination}"
    target="_new">
    <div class="creative--scrollable-mpu-inner">
        ${params.backgroundImage}
        <div class="creative--scrollable-mpu-static-image" style="background-image: url('${params.layer1Image}');"></div>
    </div>
</a>
`;

class ScrollableMpu {
	constructor(adSlot, params) {
		this.adSlot = adSlot;
		this.params = params;
		this.$scrollableImage = null;
		this.$scrollableMpu = null;
	}

	updateBgFluid250() {
		fastdom.mutate(() => {
			if (this.$scrollableImage) {
				this.$scrollableImage.addClass(
					'creative--scrollable-mpu-image-fixed',
				);
			}
		});
	}

	updateBgParallax() {
		const scrollAmount =
			Math.ceil(this.adSlot.getBoundingClientRect().top * 0.3) + 20;
		fastdom.mutate(() => {
			if (this.$scrollableImage) {
				this.$scrollableImage
					.addClass('creative--scrollable-mpu-image-parallax')
					.css('background-position', `50% ${scrollAmount}%`);
			}
		});
	}

	updateBg() {
		if (this.$scrollableMpu) {
			const position = -this.$scrollableMpu[0].getBoundingClientRect()
				.top;
			fastdom.mutate(() => {
				if (this.$scrollableImage) {
					this.$scrollableImage.css(
						'background-position',
						`100% ${position}px`,
					);
				}
			});
		}
	}

	create() {
		const templateOptions = {
			id: `scrollable-mpu-${Math.floor(Math.random() * 10000).toString(
				16,
			)}`,
			clickMacro: this.params.clickMacro,
			destination: this.params.destination,
			layer1Image: hasScrollEnabled
				? this.params.layer1Image
				: this.params.mobileImage,
			backgroundImage:
				hasScrollEnabled && this.params.backgroundImage
					? `<div class="creative--scrollable-mpu-image" style="background-image: url(${this.params.backgroundImage});"></div>`
					: '',
		};

		this.$scrollableMpu = $.create(
			scrollableMpuTpl(templateOptions),
		).appendTo(this.adSlot);

		if (this.params.trackingPixel) {
			addTrackingPixel(
				this.params.trackingPixel + this.params.cacheBuster,
			);
		}

		if (this.params.researchPixel) {
			addTrackingPixel(
				this.params.researchPixel + this.params.cacheBuster,
			);
		}

		if (this.params.viewabilityTracker) {
			addViewabilityTracker(
				this.adSlot,
				this.params.id,
				this.params.viewabilityTracker,
			);
		}

		if (hasScrollEnabled) {
			let updateFn;
			if (
				this.params.backgroundImagePType === 'fixed matching fluid250'
			) {
				updateFn = () => this.updateBgFluid250();
			} else if (this.params.backgroundImagePType === 'parallax') {
				updateFn = () => this.updateBgParallax();
			} else {
				updateFn = () => this.updateBg();
			}

			this.$scrollableImage = $(
				'.creative--scrollable-mpu-image',
				this.adSlot,
			);

			// update bg position
			fastdom.measure(updateFn);

			mediator.on('window:throttledScroll', updateFn);
			// to be safe, also update on window resize
			mediator.on('window:throttledResize', updateFn);
		}

		return Promise.resolve(true);
	}
}

export { ScrollableMpu };