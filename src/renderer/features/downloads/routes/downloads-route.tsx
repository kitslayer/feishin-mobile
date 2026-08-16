import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadManager } from '/@/renderer/features/downloads/services/download-manager';
import {
    useDownloadsStore,
    useDownloadsUsage,
} from '/@/renderer/features/downloads/store/downloads.store';
import { formatBytes, isNative } from '/@/renderer/features/downloads/utils/offline-storage';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Button } from '/@/shared/components/button/button';
import { Divider } from '/@/shared/components/divider/divider';
import { Group } from '/@/shared/components/group/group';
import { Progress } from '/@/shared/components/progress/progress';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { Song } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

const DownloadsRoute = () => {
    const { t } = useTranslation();
    const player = usePlayer();
    const catalog = useDownloadsStore((state) => state.catalog);
    const jobs = useDownloadsStore((state) => state.jobs);
    const maxBytes = useDownloadsStore((state) => state.maxBytes);
    const { bytes, count } = useDownloadsUsage();

    const tracks = useMemo(
        () => Object.values(catalog).sort((a, b) => b.savedAt - a.savedAt),
        [catalog],
    );
    const activeJobs = Object.values(jobs);

    // Queue from the stored song records rather than refetching, so this works
    // with no network -- which is the entire point of the page.
    const playAll = useCallback(
        (startAt?: string) => {
            const songs = tracks.map((track) => track.song as Song).filter(Boolean);
            if (!songs.length) return;

            const ordered = startAt
                ? [
                      ...songs.slice(songs.findIndex((song) => song.id === startAt)),
                      ...songs.slice(0, songs.findIndex((song) => song.id === startAt)),
                  ]
                : songs;

            player.addToQueueByData(ordered, Play.NOW);
        },
        [player, tracks],
    );

    return (
        <AnimatedPage>
            <ScrollArea style={{ height: '100%' }}>
                <Stack gap="md" p="md">
                    <Group justify="space-between">
                        <Text fw={700} size="xl">
                            {t('page.downloads.title', { postProcess: 'titleCase' })}
                        </Text>
                        <Text isMuted size="sm">
                            {count} · {formatBytes(bytes)}
                            {maxBytes ? ` / ${formatBytes(maxBytes)}` : ''}
                        </Text>
                    </Group>

                    {!isNative() && <Text isMuted size="sm">{t('page.downloads.nativeOnly')}</Text>}

                    {activeJobs.length > 0 && (
                        <Stack gap="xs">
                            <Group justify="space-between">
                                <Text fw={600}>{t('page.downloads.inProgress')}</Text>
                                {activeJobs.some((job) => job.status === 'error') && (
                                    <Button
                                        onClick={() => void downloadManager.retryFailed()}
                                        size="compact-sm"
                                    >
                                        {t('common.retry', { postProcess: 'titleCase' })}
                                    </Button>
                                )}
                            </Group>
                            {activeJobs.map((job) => (
                                <Stack gap={2} key={`${job.serverId}:${job.songId}`}>
                                    <Group justify="space-between">
                                        <Text lineClamp={1} size="sm">
                                            {job.title}
                                        </Text>
                                        <Text isMuted size="xs">
                                            {job.status === 'error'
                                                ? t('common.error')
                                                : `${Math.round(job.progress * 100)}%`}
                                        </Text>
                                    </Group>
                                    <Progress
                                        size="xs"
                                        value={job.status === 'error' ? 100 : job.progress * 100}
                                    />
                                </Stack>
                            ))}
                            <Divider />
                        </Stack>
                    )}

                    {tracks.length === 0 ? (
                        <Text isMuted>{t('page.downloads.empty')}</Text>
                    ) : (
                        <Stack gap="xs">
                            <Button onClick={() => playAll()}>
                                {t('player.play', { postProcess: 'titleCase' })}
                            </Button>
                            <Divider />
                            {tracks.map((track) => (
                                <Group
                                    justify="space-between"
                                    key={`${track.serverId}:${track.songId}`}
                                    wrap="nowrap"
                                >
                                    <Stack gap={0} style={{ minWidth: 0 }}>
                                        <Text lineClamp={1} size="sm">
                                            {track.song?.name ?? track.songId}
                                        </Text>
                                        <Text isMuted lineClamp={1} size="xs">
                                            {[track.song?.artistName, track.song?.album]
                                                .filter(Boolean)
                                                .join(' — ')}
                                        </Text>
                                    </Stack>
                                    <Group gap="xs" wrap="nowrap">
                                        <Text isMuted size="xs">
                                            {formatBytes(track.bytes)}
                                        </Text>
                                        <ActionIcon
                                            icon="mediaPlay"
                                            onClick={() => playAll(track.songId)}
                                            variant="subtle"
                                        />
                                        <ActionIcon
                                            icon="delete"
                                            onClick={() =>
                                                void downloadManager.remove(
                                                    track.serverId,
                                                    track.songId,
                                                )
                                            }
                                            variant="subtle"
                                        />
                                    </Group>
                                </Group>
                            ))}
                            <Divider />
                            <Button
                                onClick={() => void downloadManager.removeAll()}
                                variant="subtle"
                            >
                                {t('page.downloads.removeAll')}
                            </Button>
                        </Stack>
                    )}
                </Stack>
            </ScrollArea>
        </AnimatedPage>
    );
};

export default DownloadsRoute;
