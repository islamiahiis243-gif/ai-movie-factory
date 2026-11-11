/**
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.2B: OTT Cinematic Player Modal Wrapper
 */

import React from 'react';
import { CinematicPlayerView, ChapterMarker } from './CinematicPlayerView.tsx';

export interface OttPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  contentType: 'film' | 'episode';
  channelId: string;
  grantToken: string;
  title: string;
  posterUrl?: string;
  aspectRatio?: '16:9' | '9:16';
  chapters?: ChapterMarker[];
  subtitleVttUrl?: string;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  hasNextEpisode?: boolean;
  hasPrevEpisode?: boolean;
}

export const OttPlayerModal: React.FC<OttPlayerModalProps> = ({
  isOpen,
  onClose,
  contentId,
  contentType,
  channelId,
  grantToken,
  title,
  posterUrl,
  aspectRatio = '16:9',
  chapters,
  subtitleVttUrl,
  onNextEpisode,
  onPrevEpisode,
  hasNextEpisode,
  hasPrevEpisode,
}) => {
  if (!isOpen) return null;

  const isVertical = aspectRatio === '9:16';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 animate-fadeIn">
      <div
        className={`relative w-full ${
          isVertical ? 'max-w-md h-[90vh]' : 'max-w-5xl h-[85vh]'
        } flex items-center justify-center`}
      >
        <CinematicPlayerView
          contentId={contentId}
          contentType={contentType}
          channelId={channelId}
          grantToken={grantToken}
          title={title}
          posterUrl={posterUrl}
          aspectRatio={aspectRatio}
          chapters={chapters}
          subtitleVttUrl={subtitleVttUrl}
          onClose={onClose}
          onNextEpisode={onNextEpisode}
          onPrevEpisode={onPrevEpisode}
          hasNextEpisode={hasNextEpisode}
          hasPrevEpisode={hasPrevEpisode}
        />
      </div>
    </div>
  );
};
export default OttPlayerModal;
