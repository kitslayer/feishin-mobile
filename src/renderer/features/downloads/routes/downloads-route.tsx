import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadManager } from '/@/renderer/features/downloads/services/download-manager';
import {
    useDownloadsStore,
    useDownloadsUsage,
} from '/@/renderer/features/downloads/store/downloads.store';
import { formatBytes, isNative } from '/@/renderer/features/downloads/utils/offline-storage';
import { AnimatedPage } from '/@/renderer/features/shared/components/animated-page';
import { Button } from '/@/shared/components/button/button';
import { Divider } from '/@/shared/components/divider/divider';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Progress } from '/@/shared/components/progress/progress';
import { ScrollArea } from '/@/shared/components/scroll-area/scroll-area';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';

const DownloadsRoute = () => {
    const { t } = useTranslation();
    const catalog = useDownloadsStore((state) => state.catalog);
    const jobs = useDownloadsStore((state) => state.jobs);
    const maxBytes = useDownloadsStore((state) => state.maxBytes);
    const { bytes, count } = useDownloadsUsage();

    const tracks = Object.values(catalog).sort((a, b) => b.savedAt - a.savedAt);
    const activeJobs = Object.values(jobs);

    const handleRemoveAll = useCallback(() => {
        void downloadManager.removeAll();
    }, []);

    const handleRetry = useCallback(() => {
        void downloadManager.retryFailed();
    }, []);

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

                    {!isNative() && (
                        <Text isMuted size="sm">
                            {t('page.downloads.nativeOnly')}
                        </Text>
                    )}

                    {activeJobs.length > 0 && (
                        <Stack gap="xs">
                            <Group justify="space-between">
                                <Text fw={600}>{t('page.downloads.inProgress')}</Text>
                                {activeJobs.some((job) => job.status === 'error') && (
                                    <Button onClick={handleRetry} size="compact-sm">
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
                                        value={
                                            job.status === 'error' ? 100 : job.progress * 100
                                        }
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
                            {tracks.map((track) => (
                                <Group
                                    justify="space-between"
                                    key={`${track.serverId}:${track.songId}`}
                                >
                                    <Group gap="sm">
                                        <Icon icon="check" />
                                        <Text lineClamp={1} size="sm">
                                            {track.songId}
                                        </Text>
                                    </Group>
                                    <Group gap="sm">
                                        <Text isMuted size="xs">
                                            {formatBytes(track.bytes)}
                                        </Text>
                                        <Button
                                            onClick={() =>
                                                void downloadManager.remove(
                                                    track.serverId,
                                                    track.songId,
                                                )
                                            }
                                            size="compact-sm"
                                            variant="subtle"
                                        >
                                            {t('common.remove', { postProcess: 'titleCase' })}
                                        </Button>
                                    </Group>
                                </Group>
                            ))}
                            <Divider />
                            <Button onClick={handleRemoveAll} variant="subtle">
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
