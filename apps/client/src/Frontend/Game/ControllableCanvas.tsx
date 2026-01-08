import { Renderer } from '@darkforest_eth/renderer';
import { CursorState, ModalManagerEvent, Setting } from '@darkforest_eth/types';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useUIManager } from '../Utils/AppHooks';
import UIEmitter, { UIEmitterEvent } from '../Utils/UIEmitter';
import Viewport from './Viewport';

const CanvasWrapper = styled.div`
  width: 100%;
  height: 100%;

  position: relative;

  canvas {
    width: 100%;
    height: 100%;

    position: absolute;

    &#buffer {
      width: auto;
      height: auto;
      display: none;
    }
  }
  // TODO put this into a global style
  canvas,
  img {
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
`;

export default function ControllableCanvas() {
  // html canvas element width and height. viewport dimensions are tracked by viewport obj
  const [width, setWidth] = useState(window.innerWidth);
  const [height, setHeight] = useState(window.innerHeight);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const evtRef = canvasRef;

  const gameUIManager = useUIManager();

  const modalManager = gameUIManager.getModalManager();
  const [targeting, setTargeting] = useState<boolean>(false);

  useEffect(() => {
    const updateTargeting = (newstate: CursorState) => {
      setTargeting(newstate === CursorState.TargetingExplorer);
    };
    modalManager.on(ModalManagerEvent.StateChanged, updateTargeting);
    return () => {
      modalManager.removeListener(ModalManagerEvent.StateChanged, updateTargeting);
    };
  }, [modalManager]);

  const doResize = useCallback(() => {
    const uiEmitter: UIEmitter = UIEmitter.getInstance();
    if (canvasRef.current) {
      setWidth(canvasRef.current.clientWidth);
      setHeight(canvasRef.current.clientHeight);
      uiEmitter.emit(UIEmitterEvent.WindowResize);
    }
  }, [canvasRef]);

  // TODO fix this
  useLayoutEffect(() => {
    if (canvasRef.current) doResize();
  }, [
    // dep array gives eslint issues, but it's fine i tested it i swear - Alan
    canvasRef,
    doResize,
    /* eslint-disable react-hooks/exhaustive-deps */
    canvasRef.current?.offsetWidth,
    canvasRef.current?.offsetHeight,
    /* eslint-enable react-hooks/exhaustive-deps */
  ]);

  useEffect(() => {
    if (!gameUIManager) return;

    const uiEmitter: UIEmitter = UIEmitter.getInstance();

    function onResize() {
      doResize();
      uiEmitter.emit(UIEmitterEvent.WindowResize);
    }

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const { deltaY } = e;
      uiEmitter.emit(UIEmitterEvent.CanvasScroll, deltaY);
    };

    const canvas = evtRef.current;
    if (!canvas || !canvasRef.current || !glRef.current || !bufferRef.current) return;

    // This zooms your home world in really close to show the awesome details
    // TODO: Store this as it changes and re-initialize to that if stored
    const defaultWorldUnits = 4;
    Viewport.initialize(gameUIManager, defaultWorldUnits, canvas);
    Renderer.initialize(
      canvasRef.current,
      glRef.current,
      bufferRef.current,
      Viewport.getInstance(),
      gameUIManager,
      {
        spaceColors: {
          innerNebulaColor: gameUIManager.getStringSetting(Setting.RendererColorInnerNebula),
          nebulaColor: gameUIManager.getStringSetting(Setting.RendererColorNebula),
          spaceColor: gameUIManager.getStringSetting(Setting.RendererColorSpace),
          deepSpaceColor: gameUIManager.getStringSetting(Setting.RendererColorDeepSpace),
          deadSpaceColor: gameUIManager.getStringSetting(Setting.RendererColorDeadSpace),
        },
      }
    );
    // We can't attach the wheel event onto the canvas due to:
    // https://www.chromestatus.com/features/6662647093133312
    canvas.addEventListener('wheel', onWheel);
    window.addEventListener('resize', onResize);

    uiEmitter.on(UIEmitterEvent.UIChange, doResize);

    return () => {
      Viewport.destroyInstance();
      Renderer.destroy();
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      uiEmitter.removeListener(UIEmitterEvent.UIChange, doResize);
    };
  }, [gameUIManager, doResize, canvasRef, glRef, bufferRef, evtRef]);

  // Draw yellow square markers around player-owned planets
  useEffect(() => {
    if (!overlayRef.current || !gameUIManager) return;

    const overlayCanvas = overlayRef.current;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const drawOwnedPlanetMarkers = () => {
      const viewport = Viewport.getInstance();
      if (!viewport) {
        animationFrameId = requestAnimationFrame(drawOwnedPlanetMarkers);
        return;
      }

      // Clear the overlay
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // Get player account
      const account = gameUIManager.getAccount();
      if (!account) {
        animationFrameId = requestAnimationFrame(drawOwnedPlanetMarkers);
        return;
      }

      // Get all planets owned by the player
      const allPlanets = gameUIManager.getAllPlanets();
      const ownedPlanets = [...allPlanets].filter((planet) => planet.owner === account);

      // Draw yellow square markers for each owned planet
      ctx.strokeStyle = '#ffff00'; // Yellow
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]); // Dashed line for visibility

      for (const planet of ownedPlanets) {
        if (!planet.location) continue;

        const { x, y } = planet.location.coords;
        
        // Convert world coordinates to canvas coordinates
        const canvasCoords = viewport.worldToCanvasCoords({ x, y });
        
        // Calculate square size based on planet radius and zoom level
        const worldRadius = planet.radius || 1;
        const canvasRadius = viewport.worldToCanvasDist(worldRadius);
        const squareSize = Math.max(canvasRadius * 2.5, 20); // Minimum 20px

        // Draw square grid around the planet
        ctx.strokeRect(
          canvasCoords.x - squareSize / 2,
          canvasCoords.y - squareSize / 2,
          squareSize,
          squareSize
        );

        // Draw corner brackets for extra visibility
        const bracketSize = squareSize * 0.2;
        ctx.setLineDash([]); // Solid lines for brackets
        ctx.beginPath();
        
        // Top-left corner
        ctx.moveTo(canvasCoords.x - squareSize / 2, canvasCoords.y - squareSize / 2 + bracketSize);
        ctx.lineTo(canvasCoords.x - squareSize / 2, canvasCoords.y - squareSize / 2);
        ctx.lineTo(canvasCoords.x - squareSize / 2 + bracketSize, canvasCoords.y - squareSize / 2);
        
        // Top-right corner
        ctx.moveTo(canvasCoords.x + squareSize / 2 - bracketSize, canvasCoords.y - squareSize / 2);
        ctx.lineTo(canvasCoords.x + squareSize / 2, canvasCoords.y - squareSize / 2);
        ctx.lineTo(canvasCoords.x + squareSize / 2, canvasCoords.y - squareSize / 2 + bracketSize);
        
        // Bottom-right corner
        ctx.moveTo(canvasCoords.x + squareSize / 2, canvasCoords.y + squareSize / 2 - bracketSize);
        ctx.lineTo(canvasCoords.x + squareSize / 2, canvasCoords.y + squareSize / 2);
        ctx.lineTo(canvasCoords.x + squareSize / 2 - bracketSize, canvasCoords.y + squareSize / 2);
        
        // Bottom-left corner
        ctx.moveTo(canvasCoords.x - squareSize / 2 + bracketSize, canvasCoords.y + squareSize / 2);
        ctx.lineTo(canvasCoords.x - squareSize / 2, canvasCoords.y + squareSize / 2);
        ctx.lineTo(canvasCoords.x - squareSize / 2, canvasCoords.y + squareSize / 2 - bracketSize);
        
        ctx.stroke();
        ctx.setLineDash([5, 3]); // Reset to dashed
      }

      animationFrameId = requestAnimationFrame(drawOwnedPlanetMarkers);
    };

    drawOwnedPlanetMarkers();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameUIManager, width, height]);

  // attach event listeners
  useEffect(() => {
    if (!evtRef.current) return;
    const canvas = evtRef.current;

    const uiEmitter: UIEmitter = UIEmitter.getInstance();

    function onMouseEvent(emitEventName: UIEmitterEvent, mouseEvent: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const canvasX = mouseEvent.clientX - rect.left;
      const canvasY = mouseEvent.clientY - rect.top;
      uiEmitter.emit(emitEventName, { x: canvasX, y: canvasY });
    }

    const onMouseDown = (e: MouseEvent) => {
      onMouseEvent(UIEmitterEvent.CanvasMouseDown, e);
    };
    // this is the root of the mousemove event
    const onMouseMove = (e: MouseEvent) => {
      onMouseEvent(UIEmitterEvent.CanvasMouseMove, e);
    };
    const onMouseUp = (e: MouseEvent) => {
      onMouseEvent(UIEmitterEvent.CanvasMouseUp, e);
    };
    // TODO convert this to mouseleave
    const onMouseOut = () => {
      uiEmitter.emit(UIEmitterEvent.CanvasMouseOut);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseout', onMouseOut);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseout', onMouseOut);
    };
  }, [evtRef]);

  return (
    <CanvasWrapper style={{ cursor: targeting ? 'crosshair' : undefined }}>
      <canvas ref={glRef} width={width} height={height} />
      <canvas ref={canvasRef} width={width} height={height} />
      <canvas ref={overlayRef} width={width} height={height} style={{ pointerEvents: 'none' }} />
      <canvas ref={bufferRef} id='buffer' />
    </CanvasWrapper>
  );
}
