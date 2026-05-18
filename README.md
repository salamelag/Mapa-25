# Sistema de Logística de Suministros Geopolíticos (Mapa-25)

Este proyecto implementa una integración fluida en tiempo real entre un mapa geopolítico interactivo basado en web y servidores de Roblox Studio, permitiendo coordinar y visualizar el transporte de suministros militares entre ejércitos.

## Arquitectura General

El flujo de datos consta de dos componentes principales comunicados mediante una base de datos centralizada en Supabase:

1. **Interfaz Web (Panel de Control)**:
   * Permite a los comandantes de cada ejército seleccionar un territorio de destino.
   * Cuenta con un selector interactivo para elegir el tipo de suministro a enviar: `Armas`, `Municion`, `Gasolina`, `Medicamentos`, `Alimentos`, `Repuestos` o `Explosivos`.
   * Registra cada envío de forma inmediata en la base de datos centralizada.

2. **Servidor de Roblox (Sistema de Logística Físico)**:
   * Ejecuta un proceso de consulta periódica (polling) de alta eficiencia en segundo plano.
   * Detecta nuevos registros dirigidos al ID del ejército local en tiempo real.
   * Crea físicamente un convoy de transporte en el juego, actualiza sus carteles informativos respetando el diseño gráfico preestablecido, y ejecuta una animación física de entrada, giro de retorno y limpieza de memoria.

---

## Guía de Configuración en Roblox Studio

### 1. Script del Servidor
1. Cree un nuevo **Script** convencional de servidor dentro del servicio `ServerScriptService`.
2. Copie el código completo del archivo `roblox/SuministrosPolling.lua` y péguelo en el script creado.
3. Configure las variables de entorno en las primeras líneas del archivo:
   * `EJERCITO_ID`: Asigne el identificador único de su ejército (por ejemplo: `"25_REMASTER"`).
   * `VELOCIDAD`: Ajuste la velocidad de desplazamiento del camión en studs por segundo (recomendado: `8`).
   * `DISTANCIA_AVANCE`: Distancia física en studs que recorrerá el camión desde su punto de aparición (recomendado: `40`).
   * `EJE_MOVIMIENTO`: Determina el eje local del camión hacia el cual debe avanzar. Puede ser `"LookVector"`, `"-LookVector"`, `"RightVector"`, o `"-RightVector"` (ajuste según la orientación de importación del modelo de su vehículo).

### 2. Punto de Spawn
1. Inserte una parte física (`BasePart`) en el `Workspace` del mapa.
2. Nómbrela exactamente como `SpawnCamion`.
3. Posiciónela y oriéntela en el lugar exacto de la carretera donde desea que aparezca el camión de suministros.

### 3. Modelo del Camión
1. Coloque su modelo de vehículo en `ReplicatedStorage` y nómbrelo exactamente `CamionSuministros`.
2. Asegúrese de que el modelo tenga asignada la propiedad `PrimaryPart` apuntando a una parte central física (por ejemplo, el chasis).
3. Para mostrar la información dinámica del envío en los carteles del camión, inserte etiquetas de texto (`TextLabel`, `TextBox` o `TextButton`) dentro del modelo y nómbrelas como `Texto` o `TextLabel`. El script reemplazará automáticamente el contenido del texto sin alterar fuentes, colores, ni transparencias preconfiguradas.

---

## Funcionamiento del Convoy en Roblox

Cuando un jugador realiza un envío desde el panel web de control:
1. El servidor de Roblox procesa la orden y clona el modelo `CamionSuministros` en la posición del `SpawnCamion`.
2. Escribe de forma dinámica el tipo de carga y la facción de origen en los carteles del vehículo.
3. El camión avanza de forma totalmente física y amortiguada la distancia configurada (ej. 40 studs).
4. Permanece estacionado en su destino durante 30 segundos mientras se realiza la descarga teórica de suministros.
5. Realiza un giro controlado y fluido sobre su propio eje de 180 grados.
6. Regresa manejando de vuelta hacia el punto de spawn original.
7. Se autodestruye de forma segura para optimizar y limpiar el consumo de memoria del servidor.
8. Paralelamente, emite un aviso global por el chat del servidor informando a todas las facciones de la llegada del convoy logístico.

---

## Tecnologías Utilizadas
* **Backend y API**: Supabase (PostgreSQL) con acceso seguro mediante claves de lectura anónimas.
* **Roblox API**: HttpService, TweenService (interpolación por CFrameValue), y RemoteEvents de comunicación segura cliente-servidor.
* **Frontend Web**: HTML5, Vanilla CSS3 (diseño de interfaz de usuario militar premium), y JavaScript asíncrono.
