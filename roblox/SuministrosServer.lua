--[[
    ============================================================
    SuministrosServer.lua
    Script de SERVIDOR para Roblox Studio
    
    INSTRUCCIONES:
    1. Abre Roblox Studio en tu juego
    2. En el Explorer, ve a ServerScriptService
    3. Inserta un nuevo "Script" (no LocalScript)
    4. Pega todo este codigo
    5. Configura las variables de la seccion CONFIGURACION
    ============================================================
--]]

-- ============================================================
-- CONFIGURACION
-- ============================================================

-- Carpeta donde estara el modelo del camion de suministros
-- Debe estar en Workspace con el nombre exacto "CamionSuministros"
-- El modelo debe tener una Part principal llamada "Body"
-- y un SurfaceGui llamado "Info" con un TextLabel llamado "Texto"
local NOMBRE_MODELO_CAMION = "CamionSuministros"

-- Ruta que recorre el camion (puntos en el mapa)
-- Ajusta estas coordenadas a tu mapa real en Roblox Studio
local RUTA_CAMION = {
    Vector3.new(0,   5, 100),   -- punto de entrada
    Vector3.new(50,  5, 100),
    Vector3.new(100, 5, 50),
    Vector3.new(150, 5, 0),     -- punto de entrega
}

-- Velocidad del camion (studs por segundo)
local VELOCIDAD = 20

-- Tiempo que el camion espera en el destino antes de desaparecer
local TIEMPO_EN_DESTINO = 8

-- ============================================================
-- LOGICA (no editar salvo que sepas Lua)
-- ============================================================

local MessagingService = game:GetService("MessagingService")
local TweenService     = game:GetService("TweenService")
local RunService       = game:GetService("RunService")

local TOPIC = "suministros"

-- Icono por tipo de suministro (texto simple)
local ICONOS = {
    armas         = "[ ARMAS ]",
    municion      = "[ MUNICION ]",
    gasolina      = "[ GASOLINA ]",
    medicamentos  = "[ MEDICAMENTOS ]",
    alimentos     = "[ ALIMENTOS ]",
    vehiculos     = "[ VEHICULOS ]",
    explosivos    = "[ EXPLOSIVOS ]",
}

-- Colores del cartel por tipo
local COLORES = {
    armas        = Color3.fromRGB(200, 50,  50),
    municion     = Color3.fromRGB(200, 100, 30),
    gasolina     = Color3.fromRGB(50,  150, 220),
    medicamentos = Color3.fromRGB(50,  200, 100),
    alimentos    = Color3.fromRGB(200, 180, 50),
    vehiculos    = Color3.fromRGB(100, 100, 200),
    explosivos   = Color3.fromRGB(220, 50,  220),
}

-- Funcion que mueve el camion a lo largo de la ruta
local function moverCamion(camion, tipo, origen, destino)
    local body   = camion:FindFirstChild("Body")
    local gui    = camion:FindFirstChild("Info", true)
    local label  = gui and gui:FindFirstChild("Texto")
    
    -- Configurar el cartel del camion
    if label then
        label.Text = string.format(
            "SUMINISTROS\n%s\nDe: %s\nPara: %s",
            (ICONOS[tipo] or tipo:upper()),
            origen,
            destino
        )
        if gui and COLORES[tipo] then
            gui.BackgroundColor3 = COLORES[tipo]
        end
    end
    
    camion.Parent = workspace
    
    -- Mover por cada punto de la ruta
    for i, punto in ipairs(RUTA_CAMION) do
        if body then
            local distancia = (body.Position - punto).Magnitude
            local duracion  = distancia / VELOCIDAD
            
            local tween = TweenService:Create(
                body,
                TweenInfo.new(duracion, Enum.EasingStyle.Linear),
                { Position = punto }
            )
            tween:Play()
            tween.Completed:Wait()
        end
    end
    
    -- Esperar en destino
    task.wait(TIEMPO_EN_DESTINO)
    
    -- Anuncio en juego cuando llega
    game.StarterGui:SetCore("ChatMakeSystemMessage", {
        Text      = string.format("[SUMINISTROS] Convoy de %s llego a %s con %s", origen, destino, tipo),
        Color     = COLORES[tipo] or Color3.fromRGB(50, 200, 100),
        Font      = Enum.Font.GothamBold,
        FontSize  = Enum.FontSize.Size18,
    })
    
    -- Quitar el camion del workspace
    camion.Parent = nil
end

-- Escuchar mensajes del backend via MessagingService
local function iniciar()
    local ok, err = pcall(function()
        MessagingService:SubscribeAsync(TOPIC, function(message)
            -- Parsear el JSON recibido
            local payload = game:GetService("HttpService"):JSONDecode(message.Data)
            
            local tipo    = payload.tipo    or "desconocido"
            local origen  = payload.origen  or "Desconocido"
            local destino = payload.destino or "Desconocido"
            local id      = payload.id      or 0
            
            print(string.format(
                "[SUMINISTROS] Recibido #%d: %s de '%s' para '%s'",
                id, tipo, origen, destino
            ))
            
            -- Buscar el modelo del camion en ReplicatedStorage o ServerStorage
            local plantilla = game:GetService("ReplicatedStorage"):FindFirstChild(NOMBRE_MODELO_CAMION)
                           or game:GetService("ServerStorage"):FindFirstChild(NOMBRE_MODELO_CAMION)
            
            if not plantilla then
                warn("[SUMINISTROS] No se encontro el modelo '" .. NOMBRE_MODELO_CAMION .. "' en ReplicatedStorage ni ServerStorage")
                return
            end
            
            -- Clonar y animar en un hilo separado
            local camionClone = plantilla:Clone()
            camionClone:SetPrimaryPartCFrame(
                CFrame.new(RUTA_CAMION[1])
            )
            
            task.spawn(moverCamion, camionClone, tipo, origen, destino)
        end)
    end)
    
    if not ok then
        warn("[SUMINISTROS] Error al suscribirse a MessagingService: " .. tostring(err))
        warn("[SUMINISTROS] Asegurate de que el juego esta publicado y MessagingService esta habilitado")
    else
        print("[SUMINISTROS] Servidor de suministros activo, escuchando topic: " .. TOPIC)
    end
end

iniciar()
