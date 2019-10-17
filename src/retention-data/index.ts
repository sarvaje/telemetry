import { AzureFunction, Context } from '@azure/functions';

import { getLatestRetention, getActivities } from './api';
import { getDaysBetweenDates, getISODateString } from './utils';
import { getRetentionData } from './retention';
import { trackEvent, sendPendingData } from './analytics';

const retentionData: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
    const latestRetention = await getLatestRetention();
    const dates: Date[] = [];

    if (!latestRetention) {
        context.log('No latest retention found, using "now" as date');
        dates.push(new Date(getISODateString()));
    } else {
        const delta = getDaysBetweenDates(new Date(getISODateString()), latestRetention.date as Date);

        context.log(`Processing days: ${delta}`);
        // If delta === 0, we already have the retention data for today.
        if (delta !== 0) {
            const today = new Date(getISODateString());

            for (let i = 0; i < delta; i++) {
                const date = new Date(today);

                date.setUTCDate(date.getUTCDate() - i);

                dates.push(date);
            }
        }
    }

    if (dates.length === 0) {
        context.log('No data to update.');

        return;
    }

    const promises = dates.map((date) => {
        return getActivities(date)
            .then((activities) => {
                const retentionData = getRetentionData(activities, date);

                trackEvent('f12-retention', retentionData);
            });
    });

    await Promise.all(promises);
    await sendPendingData();
};

export default retentionData;
