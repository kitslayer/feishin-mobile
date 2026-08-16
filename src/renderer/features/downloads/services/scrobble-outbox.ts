/**
 * Durable queue for scrobbles that could not be sent.
 *
 * Scrobbling is fire-and-forget: react-query's default networkMode pauses a
 * mutation while offline, and the caller marks the track as scrobbled straight
 * after calling mutate rather than in onSuccess -- so an offline play was
 * silently dropped when the app was killed. With offline playback that stops
 * being an edge case and becomes the normal path.
 */
import { get, set } from 'idb-keyval';

import { api } from '/@/renderer/api';
import { logger } from '/@/renderer/utils/logger';
import { ScrobbleArgs } from '/@/shared/types/domain-types';

const OUTBOX_KEY = 'feishin-scrobble-outbox';

interface QueuedScrobble {
    args: ScrobbleArgs;
    /** Epoch ms the play actually happened, so a deferred send is not misdated. */
    at: number;
}

let flushing = false;

const read = async (): Promise<QueuedScrobble[]> =>
    (await get<QueuedScrobble[]>(OUTBOX_KEY).catch(() => undefined)) ?? [];

const write = async (entries: QueuedScrobble[]) => {
    await set(OUTBOX_KEY, entries).catch(() => {});
};

export const scrobbleOutbox = {
    /** Stores a scrobble to send once connectivity returns. */
    enqueue: async (args: ScrobbleArgs) => {
        const entries = await read();
        entries.push({ args, at: Date.now() });
        await write(entries);
        logger.info(`[scrobble] queued offline (${entries.length} pending)`);
    },

    /** Attempts to send everything queued; keeps whatever still fails. */
    flush: async () => {
        if (flushing) return;
        flushing = true;

        try {
            const entries = await read();
            if (!entries.length) return;

            const remaining: QueuedScrobble[] = [];

            for (const entry of entries) {
                try {
                    await api.controller.scrobble({
                        ...entry.args,
                        apiClientProps: {
                            serverId: entry.args.apiClientProps.serverId,
                        },
                        // Subsonic accepts the original listen time; without it a
                        // deferred scrobble lands at sync time instead.
                        query: { ...entry.args.query, time: entry.at },
                    } as ScrobbleArgs);
                } catch {
                    remaining.push(entry);
                }
            }

            await write(remaining);

            if (remaining.length !== entries.length) {
                logger.info(`[scrobble] flushed ${entries.length - remaining.length} queued plays`);
            }
        } finally {
            flushing = false;
        }
    },

    size: async () => (await read()).length,
};
