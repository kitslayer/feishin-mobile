import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { api } from '/@/renderer/api';
import {
    downloadsActions,
    getDownloadedTrack,
    useDownloadedTrack,
} from '/@/renderer/features/downloads/store/downloads.store';
import { TranscodingConfig } from '/@/renderer/store';
import { QueueSong } from '/@/shared/types/domain-types';

export function useSongUrl(
    song: QueueSong | undefined,
    current: boolean,
    transcode: Partial<TranscodingConfig>,
): string | undefined {
    const prior = useRef(['', '']);

    // Downloaded tracks short-circuit everything below. This lookup is
    // deliberately synchronous: resolving it via a query would leave a render
    // where src is undefined, and the engine treats that as an empty source and
    // never starts the track. It also has to bypass getStreamUrl entirely,
    // because that makes a network call for a transcode decision -- which would
    // hang and then fail while offline, exactly when the local file matters.
    const downloaded = useDownloadedTrack(song?._serverId, song?.id);

    const shouldReusePrior = Boolean(
        song?._serverId && current && prior.current[0] === song._uniqueId && prior.current[1],
    );

    const { data: queryStreamUrl } = useQuery({
        enabled: Boolean(song?._serverId) && !shouldReusePrior && !downloaded,
        queryFn: () =>
            api.controller.getStreamUrl({
                apiClientProps: { serverId: song!._serverId },
                query: {
                    bitrate: transcode.bitrate,
                    format: transcode.format,
                    id: song!.id,
                    transcode: transcode.enabled ?? false,
                },
            }),
        queryKey: [
            song?._serverId,
            'stream-url',
            song?.id,
            shouldReusePrior ? 'reuse-prior' : transcode.bitrate,
            shouldReusePrior ? 'reuse-prior' : transcode.format,
            shouldReusePrior ? 'reuse-prior' : transcode.enabled,
        ] as const,
        staleTime: 60 * 1000,
    });

    useEffect(() => {
        if (!song?._serverId) {
            prior.current = ['', ''];
            return;
        }

        if (!queryStreamUrl) {
            return;
        }

        // Save resolved URL to avoid restarting current track on transcode setting changes.
        prior.current = [song._uniqueId, queryStreamUrl];
    }, [song?._serverId, song?._uniqueId, queryStreamUrl]);

    useEffect(() => {
        if (!song?._serverId) {
            prior.current = ['', ''];
        }
    }, [song?._serverId]);

    // Keep LRU recency fresh so eviction drops what is genuinely unused.
    useEffect(() => {
        if (downloaded && current && song?._serverId) {
            downloadsActions.touch(song._serverId, song.id);
        }
    }, [downloaded, current, song?._serverId, song?.id]);

    if (downloaded) {
        return downloaded.localUrl;
    }

    return shouldReusePrior ? prior.current[1] : queryStreamUrl;
}

export const getSongUrl = async (
    song: QueueSong,
    transcode: Partial<TranscodingConfig>,
    skipAutoTranscode?: boolean,
) => {
    const downloaded = getDownloadedTrack(song._serverId, song.id);
    if (downloaded) {
        return downloaded.localUrl;
    }

    const url = await api.controller.getStreamUrl({
        apiClientProps: { serverId: song._serverId },
        query: {
            bitrate: transcode.bitrate,
            format: transcode.format,
            id: song.id,
            skipAutoTranscode,
            transcode: transcode.enabled ?? false,
        },
    });

    return url;
};
