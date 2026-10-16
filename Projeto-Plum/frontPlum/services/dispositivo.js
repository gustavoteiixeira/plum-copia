import * as Device from "expo-device";
import Constants from "expo-constants";

// expo-device -> texto legível
const TIPOS = {
  [Device.DeviceType.PHONE]: "celular",
  [Device.DeviceType.TABLET]: "tablet",
  [Device.DeviceType.DESKTOP]: "desktop",
  [Device.DeviceType.TV]: "tv",
};

/**
 * Informações do aparelho (sem permissão e sem identificador único).
 * Servem para comprovar uso em celulares reais e diferentes no TCC.
 */
export function obterInfoDispositivo() {
  return {
    // false = emulador/simulador
    celular_real: Device.isDevice,
    marca: Device.brand ?? null,
    fabricante: Device.manufacturer ?? null,
    modelo: Device.modelName ?? null,
    sistema: Device.osName ?? null,
    versao_sistema: Device.osVersion ?? null,
    tipo: TIPOS[Device.deviceType] ?? "desconhecido",
    versao_app: Constants.expoConfig?.version ?? null,
  };
}
