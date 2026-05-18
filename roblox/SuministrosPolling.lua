--[[
    ============================================================
    SuministrosPolling.lua  (VERSION RECOMENDADA)
    Script de SERVIDOR para Roblox Studio
    
    VENTAJA sobre MessagingService:
    - Funciona en cualquier juego de cualquier creador
    - No necesita API Key de Roblox Open Cloud
    - Solo necesita el ID del ejercito en el mapa (ej: "25_REMASTER")
    
    INSTRUCCIONES:
    1. En Roblox Studio → ServerScriptService
    2. Nuevo Script de servidor → pegar este codigo
    3. Cambiar EJERCITO_ID al ID de TU ejercito en el mapa
    4. Crear modelo "CamionSuministros" en ReplicatedStorage con:
       - Part principal llamada "PrimaryPart" (set as PrimaryPart)
       - Model o Part hijo llamado "Cartel" (opcional, para mostrar texto)
    ============================================================
--]]

-- ============================================================
-- CONFIGURACION — editar esto
-- ============================================================

-- ID de TU ejercito en el mapa (ver tabla de ejercitos)
local EJERCITO_ID = "25_REMASTER"

-- Cuantos segundos esperar entre cada verificacion de nuevos suministros
local INTERVALO_POLLING = 5

-- URL base del backend (no cambiar)
local SUPABASE_URL  = "https://hwyedjcprazfnzgvughb.supabase.co"
local SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3eWVkamNwcmF6Zm56Z3Z1Z2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MDU4MzMsImV4cCI6MjA5NDQ4MTgzM30.BQPEDKZXu5HvNoZ0Dft3u8Bnp74SE78Lb-eZWYEEN8A"

-- Ruta del camion (ajustar a tu mapa)
local RUTA_CAMION = {
    Vector3.new(0,   5, 100),
    Vector3.new(50,  5, 80),
    Vector3.new(100, 5, 40),
    Vector3.new(150, 5, 0),
}
local VELOCIDAD        = 25   -- studs/segundo
local TIEMPO_DESTINO   = 8    -- segundos en destino

-- ============================================================
-- LOGICA
-- ============================================================

local HttpService  = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")

-- Guardamos el ultimo ID procesado para no repetir eventos
local ultimoIdProcesado = 0

-- Colores por tipo de suministro
local COLORES = {
    armas        = Color3.fromRGB(200, 50,  50),
    municion     = Color3.fromRGB(220, 110, 30),
    gasolina     = Color3.fromRGB(50,  150, 220),
    medicamentos = Color3.fromRGB(50,  200, 100),
    alimentos    = Color3.fromRGB(200, 180, 50),
    vehiculos    = Color3.fromRGB(100, 100, 200),
    explosivos   = Color3.fromRGB(220, 50,  220),
}

local function animarCamion(tipo, origen, destino)
    local plantilla = game:GetService("ReplicatedStorage"):FindFirstChild("CamionSuministros")
    if not plantilla then
        warn("[SUMINISTROS] No encontre 'CamionSuministros' en ReplicatedStorage")
        return
    end

    local camion = plantilla:Clone()
    camion.Parent = workspace

    -- Posicionar en inicio
    if camion.PrimaryPart then
        camion:SetPrimaryPartCFrame(CFrame.new(RUTA_CAMION[1]))
    end

    -- Actualizar cartel si existe
    local cartel = camion:FindFirstChild("Cartel", true)
    if cartel and cartel:IsA("SurfaceGui") then
        local label = cartel:FindFirstChildWhichIsA("TextLabel")
        if label then
            label.Text = string.format("SUMINISTROS\n%s\nDE: %s\nPARA: %s", tipo:upper(), origen, destino)
            if cartel.Parent and COLORES[tipo] then
                cartel.BackgroundColor3 = COLORES[tipo]
            end
        end
    end

    -- Mover por la ruta
    for _, punto in ipairs(RUTA_CAMION) do
        local part = camion.PrimaryPart
        if not part then break end
        local distancia = (part.Position - punto).Magnitude
        local duracion  = math.max(0.1, distancia / VELOCIDAD)
        local tween = TweenService:Create(
            part,
            TweenInfo.new(duracion, Enum.EasingStyle.Linear),
            { CFrame = CFrame.new(punto) }
        )
        tween:Play()
        tween.Completed:Wait()
    end

    -- Anuncio en chat del servidor
    local StarterGui = game:GetService("StarterGui")
    pcall(function()
        StarterGui:SetCore("ChatMakeSystemMessage", {
            Text     = string.format("[LOGISTICA] Convoy de '%s' llego a '%s' con %s", origen, destino, tipo:upper()),
            Color    = COLORES[tipo] or Color3.fromRGB(50, 200, 100),
            Font     = Enum.Font.GothamBold,
            FontSize = Enum.FontSize.Size18,
        })
    end)

    task.wait(TIEMPO_DESTINO)
    camion:Destroy()
end

local function verificarNuevosEventos()
    -- Consultar suministros nuevos para ESTE ejercito que no se han procesado
    local url = string.format(
        "%s/rest/v1/historial_suministros?ejercito_destino=eq.%s&id=gt.%d&order=id.asc&select=id,tipo_suministro,ejercito_origen,ejercito_destino",
        SUPABASE_URL,
        EJERCITO_ID,
        ultimoIdProcesado
    )

    local ok, res = pcall(function()
        return HttpService:RequestAsync({
            Url    = url,
            Method = "GET",
            Headers = {
                ["apikey"]        = SUPABASE_ANON,
                ["Authorization"] = "Bearer " .. SUPABASE_ANON,
                ["Content-Type"]  = "application/json",
            }
        })
    end)

    if not ok or not res.Success then
        warn("[SUMINISTROS] Error al consultar Supabase:", res and res.Body or "sin respuesta")
        return
    end

    local datos = HttpService:JSONDecode(res.Body)
    if type(datos) ~= "table" or #datos == 0 then return end

    for _, evento in ipairs(datos) do
        ultimoIdProcesado = math.max(ultimoIdProcesado, evento.id)
        
        print(string.format(
            "[SUMINISTROS] Nuevo evento #%d: %s de '%s'",
            evento.id, evento.tipo_suministro, evento.ejercito_origen
        ))

        -- Necesitamos el nombre del origen (solo tenemos el ID)
        -- Lo simplificamos con el ID por ahora; se puede mejorar con un join
        task.spawn(animarCamion, evento.tipo_suministro, evento.ejercito_origen, EJERCITO_ID)
    end
end

-- Inicializar: cargar el ultimo ID ya existente para no reproducir eventos viejos
local function inicializar()
    local url = string.format(
        "%s/rest/v1/historial_suministros?ejercito_destino=eq.%s&order=id.desc&limit=1&select=id",
        SUPABASE_URL,
        EJERCITO_ID
    )
    local ok, res = pcall(function()
        return HttpService:RequestAsync({
            Url    = url,
            Method = "GET",
            Headers = {
                ["apikey"]        = SUPABASE_ANON,
                ["Authorization"] = "Bearer " .. SUPABASE_ANON,
            }
        })
    end)
    if ok and res.Success then
        local d = HttpService:JSONDecode(res.Body)
        if d and #d > 0 then
            ultimoIdProcesado = d[1].id
            print("[SUMINISTROS] Iniciando desde evento #" .. ultimoIdProcesado)
        end
    end

    print("[SUMINISTROS] Polling activo para ejercito: " .. EJERCITO_ID)
    print("[SUMINISTROS] Verificando cada " .. INTERVALO_POLLING .. " segundos")

    -- Loop de polling
    while true do
        task.wait(INTERVALO_POLLING)
        verificarNuevosEventos()
    end
end

-- Habilitar HttpService (debe estar habilitado en Game Settings → Security)
inicializar()
