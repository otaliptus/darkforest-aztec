import { EventEmitter } from 'events';
import { detailedLogger } from '../../Backend/Utils/DetailedLogger';

export const enum UIEmitterEvent {
  GamePlanetSelected = 'GamePlanetSelected',
  CenterPlanet = 'CenterPlanet',
  WindowResize = 'WindowResize',

  UIChange = 'UIChange', // whenever you collapse, etc.

  CanvasMouseDown = 'CanvasMouseDown',
  CanvasMouseMove = 'CanvasMouseMove',
  CanvasMouseUp = 'CanvasMouseUp',
  CanvasMouseOut = 'CanvasMouseOut',
  CanvasScroll = 'CanvasScroll',

  WorldMouseDown = 'WorldMouseDown',
  WorldMouseClick = 'WorldMouseClick',
  WorldMouseMove = 'WorldMouseMove',
  WorldMouseUp = 'WorldMouseUp',
  WorldMouseOut = 'WorldMouseOut',

  ZoomIn = 'ZoomIn',
  ZoomOut = 'ZoomOut',

  SendInitiated = 'SendInitiated',
  SendCancelled = 'SendCancelled',
  SendCompleted = 'SendCompleted',

  DepositArtifact = 'DepositArtifact',
  DepositToPlanet = 'DepositToPlanet',

  SelectArtifact = 'SelectArtifact',
  ShowArtifact = 'ShowArtifact',
}

class UIEmitter extends EventEmitter {
  static instance: UIEmitter;
  private readonly noisyEvents = new Set<string>([
    UIEmitterEvent.CanvasMouseMove,
    UIEmitterEvent.WorldMouseMove,
    UIEmitterEvent.CanvasScroll,
    UIEmitterEvent.CanvasMouseDown,
    UIEmitterEvent.CanvasMouseUp,
    UIEmitterEvent.WorldMouseDown,
    UIEmitterEvent.WorldMouseUp,
  ]);

  private constructor() {
    super();
  }

  static getInstance(): UIEmitter {
    if (!UIEmitter.instance) {
      UIEmitter.instance = new UIEmitter();
    }

    return UIEmitter.instance;
  }

  static initialize(): UIEmitter {
    const uiEmitter = new UIEmitter();

    return uiEmitter;
  }

  emit(event: UIEmitterEvent | string, ...args: unknown[]): boolean {
    const eventName = String(event);
    if (!this.noisyEvents.has(eventName)) {
      detailedLogger.log('ui', eventName, { args }, 'debug');
    }
    return super.emit(event as string, ...args);
  }
}

export default UIEmitter;
