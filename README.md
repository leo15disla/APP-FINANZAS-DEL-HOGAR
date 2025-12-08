# Finanzas del Hogar – Aplicación web

**Finanzas del Hogar** es una aplicación PWA desarrollada para gestionar los ingresos, gastos y cuentas de un hogar de forma fácil e intuitiva. Su diseño toma inspiración de la estética de iOS, con colores púrpura, bordes redondeados y micro‑animaciones suaves.

## Características principales

- **Dashboard**: Resumen del mes con tarjetas de ingresos, gastos, balance y diferencias frente al mes anterior, además de gráficos simples y visualización de cuentas.
- **Registrar movimiento**: Formulario rápido para agregar ingresos o gastos con tipo, monto, categoría, fecha y nota. Las categorías rápidas permiten seleccionar con un clic.
- **Movimientos**: Listado dinámico con filtros avanzados (tipo, rango de fechas, categoría, búsqueda) y resumen de totales por ingresos, gastos y balance.
- **Cuentas**: Tarjetas al estilo Apple Wallet que muestran el nombre, tipo, saldo y última actualización. Incluye formulario para añadir o editar cuentas.
- **Préstamos**: Sistema completo para registrar préstamos con métodos de amortización francesa, americana o interés compuesto diario. Genera cronogramas de pagos y muestra métricas de progreso y próximo pago.
- **Calendario**: Vista mensual con indicadores de movimientos (amarillo) y cuotas de préstamos (morado). Al seleccionar un día muestra los detalles y totales.
- **Presupuesto**: Permite definir categorías de gasto con límites mensuales, calculando el gasto real por categoría y mostrando barras de progreso con colores verde, amarillo o rojo según el nivel de consumo. Incluye resumen 50/30/20.
- **Exportar**: Exporta todos los datos (movimientos, cuentas, préstamos, presupuestos) en formatos JSON, CSV y TXT. También genera un informe financiero en PDF con los totales del mes y un resumen general.
- **Ajustes**: Configuración de nombre de usuario, moneda, modo oscuro, animaciones, tamaño de fuente, contraste alto y sistema de backups (exportar e importar). Posibilidad de optimizar la aplicación limpiando cachés y restaurar valores predeterminados.

## Instalación y uso

1. Descarga o clona este repositorio y abre `index.html` en tu navegador.
2. Para una experiencia completa como PWA, sirve la carpeta con un servidor web (por ejemplo, `python -m http.server`) y abre la URL correspondiente. Podrás instalar la aplicación en iOS o Android desde el navegador.
3. Navega entre las secciones usando la barra superior. La aplicación funciona sin conexión gracias al service worker y guarda tus datos en el almacenamiento local del navegador.

## Captura de pantalla

![Captura de pantalla](placeholder.png)

## Requisitos técnicos

- PWA instalable con `manifest.json` y `service-worker.js` optimizados.
- Código JavaScript modular organizado en una SPA, con uso extensivo de `LocalStorage`.
- Estilos CSS inspirados en iOS y variables de color para personalización.
- Compatibilidad con navegadores modernos y dispositivos móviles.

## Licencia

Este proyecto se distribuye con fines educativos y no tiene licencia específica. Puedes modificarlo y adaptarlo según tus necesidades.