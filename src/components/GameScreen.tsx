import { AppBar, Toolbar, IconButton, Typography, Box } from '@mui/material';
import { ArrowBack, IosShare } from '@mui/icons-material';
import { type CardContent } from '../types';

interface CardColors {
  primary: string;
  secondary: string;
  text: string;
}

interface GameScreenProps {
  card: CardContent;
  cardColors: CardColors;
  onClose: () => void;
  /** Triggers the share/copy shortcut flow */
  onShortcut: () => void;
  /** Opens the location management dialog */
  onOpenLocation: () => void;
}

function GameScreen({ card, cardColors, onClose, onShortcut }: GameScreenProps) {
  const level = card.level ?? 0;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, #070114 0%, #150430 35%, #200943 65%, #070114 100%)',
        animation: 'gameScreenIn 0.55s cubic-bezier(0.34, 1.3, 0.64, 1) forwards',
        '@keyframes gameScreenIn': {
          '0%':   { transform: 'scale(0.06) rotate(-5deg)', opacity: 0, borderRadius: '50%' },
          '65%':  { transform: 'scale(1.04) rotate(1.5deg)', opacity: 1, borderRadius: '20px' },
          '82%':  { transform: 'scale(0.97) rotate(-0.5deg)', opacity: 1 },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: 1, borderRadius: '0px' },
        },
      }}
    >
      {/* ── AppBar ── */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${cardColors.secondary}33`,
        }}
      >
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="back">
            <ArrowBack />
          </IconButton>

          <Typography
            variant="h6"
            sx={{ ml: 1, fontWeight: 'bold', letterSpacing: '0.02em', flexGrow: 1 }}
          >
            {card.store_name}
            <Typography
              component="span"
              sx={{ ml: 1.5, fontWeight: 'normal', opacity: 0.55, fontSize: '0.78em' }}
            >
              — Level {level}
            </Typography>
          </Typography>

          <IconButton color="inherit" onClick={onShortcut} aria-label="add shortcut">
            <IosShare sx={{ fontSize: '1.2rem' }} />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* ── Main content ── */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          p: 4,
          gap: 3,
        }}
      >
        {/* Ambient background glow matching card colour */}
        <Box
          sx={{
            position: 'absolute',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${cardColors.secondary}2a 0%, transparent 68%)`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />

        {/* Level badge */}
        <Box
          sx={{
            width: 164,
            height: 164,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.06)',
            border: `4px solid ${cardColors.secondary}`,
            boxShadow: `0 0 36px ${cardColors.secondary}77, 0 0 80px ${cardColors.secondary}22`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation:
              'badgePop 0.5s 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both, badgeGlow 2.6s 0.8s ease-in-out infinite',
            '@keyframes badgePop': {
              '0%':   { transform: 'scale(0) rotate(-200deg)', opacity: 0 },
              '100%': { transform: 'scale(1) rotate(0deg)',    opacity: 1 },
            },
            '@keyframes badgeGlow': {
              '0%, 100%': { boxShadow: `0 0 28px ${cardColors.secondary}55, 0 0 56px ${cardColors.secondary}18` },
              '50%':      { boxShadow: `0 0 56px ${cardColors.secondary}bb, 0 0 110px ${cardColors.secondary}44` },
            },
            zIndex: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.55)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              mb: 0.25,
            }}
          >
            Level
          </Typography>
          <Typography
            variant="h2"
            sx={{
              color: '#fff',
              fontWeight: 'bold',
              lineHeight: 1,
              textShadow: `0 0 24px ${cardColors.secondary}`,
            }}
          >
            {level}
          </Typography>
        </Box>

        {/* Store name */}
        <Typography
          variant="h4"
          sx={{
            color: '#fff',
            fontWeight: 'bold',
            textAlign: 'center',
            textShadow: '0 2px 14px rgba(0,0,0,0.6)',
            animation: 'fadeUp 0.4s 0.5s ease both',
            '@keyframes fadeUp': {
              '0%':   { transform: 'translateY(18px)', opacity: 0 },
              '100%': { transform: 'translateY(0)',    opacity: 1 },
            },
            zIndex: 1,
          }}
        >
          {card.store_name}
        </Typography>

        {/* Teaser copy */}
        <Typography
          variant="body1"
          sx={{
            color: 'rgba(255,255,255,0.38)',
            textAlign: 'center',
            animation: 'fadeUp 0.4s 0.65s ease both',
            zIndex: 1,
          }}
        >
          Your adventure begins here…
        </Typography>
      </Box>
    </Box>
  );
}

export default GameScreen;
