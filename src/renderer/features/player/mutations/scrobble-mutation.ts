import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { api } from '/@/renderer/api';
import { scrobbleOutbox } from '/@/renderer/features/downloads/services/scrobble-outbox';
import { queryKeys } from '/@/renderer/api/query-keys';
import { MutationOptions } from '/@/renderer/lib/react-query';
import { incrementQueuePlayCount } from '/@/renderer/store/player.store';
import { ScrobbleArgs, ScrobbleResponse } from '/@/shared/types/domain-types';

export const useSendScrobble = (options?: MutationOptions) => {
    const queryClient = useQueryClient();

    return useMutation<ScrobbleResponse, AxiosError, ScrobbleArgs, null>({
        mutationFn: async (args) => {
            try {
                return await api.controller.scrobble({
                    ...args,
                    apiClientProps: { serverId: args.apiClientProps.serverId },
                });
            } catch (error) {
                // A failed submission would otherwise be lost: the caller marks
                // the track scrobbled right after mutate() rather than in
                // onSuccess, and react-query pauses (not fails) mutations while
                // offline. Persist it so the play survives an app kill.
                if (args.query.submission) {
                    await scrobbleOutbox.enqueue(args);
                }
                throw error;
            }
        },
        onSuccess: (_data, variables) => {
            // Manually increment the play count for the song in the queue if scrobble was submitted
            if (variables.query.submission) {
                const serverId = variables.apiClientProps.serverId;
                incrementQueuePlayCount([variables.query.id]);

                // Invalidate the album detail query for the song's album
                if (variables.query.albumId) {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.albums.detail(serverId, {
                            id: variables.query.albumId,
                        }),
                    });
                }

                // Invalidate recently played carousel on home route
                queryClient.invalidateQueries({
                    queryKey: ['home', 'recentlyPlayed'],
                });

                // Invalidate most played carousel on home route
                queryClient.invalidateQueries({
                    queryKey: ['home', 'mostPlayed'],
                });

                // Invalidate album artist top songs
                queryClient.invalidateQueries({
                    queryKey: queryKeys.albumArtists.topSongs(serverId),
                });

                // Invalidate album artist favorite songs
                queryClient.invalidateQueries({
                    queryKey: queryKeys.albumArtists.favoriteSongs(serverId),
                });
            }
        },
        ...options,
    });
};
