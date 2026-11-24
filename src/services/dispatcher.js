const { webhookUrl, vipWebhookUrl, dispatchTimeoutMs } = require('../config');

async function dispatchEvent(event) {
    const targetUrl = event.is_vip ? vipWebhookUrl : webhookUrl;

    if (!targetUrl) {
        throw new Error(
            `Missing webhook URL for ${event.is_vip ? 'VIP' : 'regular'} orders`
        );
    }

    const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
            'X-Event-Id': event.event_id,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(event.payload),
        signal: AbortSignal.timeout(dispatchTimeoutMs),
    });

    if (!response.ok) {
        throw new Error(
            `Webhook delivery failed with HTTP ${response.status}`
        );
    }

    return {
        status: response.status,
    };
}

module.exports = {
    dispatchEvent,
};
