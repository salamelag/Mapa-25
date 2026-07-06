local EJERCITO_ID = "25_REMASTER"
local INTERVALO_POLLING = 5

local SUPABASE_URL  = "https://hwyedjcprazfnzgvughb.supabase.co"
local SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3eWVkamNwcmF6Zm56Z3Z1Z2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MDU4MzMsImV4cCI6MjA5NDQ4MTgzM30.BQPEDKZXu5HvNoZ0Dft3u8Bnp74SE78Lb-eZWYEEN8A"

local RUTA_CAMION = {
    Vector3.new(0,   5, 100),
    Vector3.new(50,  5, 80),
    Vector3.new(100, 5, 40),
    Vector3.new(150, 5, 0),
}
local VELOCIDAD        = 8
local TIEMPO_DESTINO   = 30
local DISTANCIA_AVANCE = 40
local EJE_MOVIMIENTO   = "RightVector"

local HttpService  = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")

local ultimoIdProcesado = 0

local COLORES = {
    armas        = Color3.fromRGB(200, 50,  50),
    municion     = Color3.fromRGB(220, 110, 30),
    gasolina     = Color3.fromRGB(50,  150, 220),
    medicamentos = Color3.fromRGB(50,  200, 100),
    alimentos    = Color3.fromRGB(200, 180, 50),
    repuestos    = Color3.fromRGB(100, 100, 200),
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

    if not camion.PrimaryPart then
        warn("[SUMINISTROS] ADVERTENCIA: El modelo 'CamionSuministros' NO tiene asignado un 'PrimaryPart' en las propiedades de Roblox Studio. Se recomienda asignar una parte central (como 'Chasis') como PrimaryPart para evitar desfases.")
    end

    local spawnCFrame
    local spawnPart = workspace:FindFirstChild("SpawnCamion") or workspace:FindFirstChild("CamionSpawn")
    if spawnPart and spawnPart:IsA("BasePart") then
        spawnCFrame = spawnPart.CFrame
        print("[SUMINISTROS] Usando SpawnPart:", spawnPart:GetFullName())
    else
        spawnCFrame = CFrame.new(RUTA_CAMION[1])
        print("[SUMINISTROS] Usando RUTA_CAMION[1]")
    end

    camion:PivotTo(spawnCFrame)

    local cartelesEncontrados = 0
    for _, descendant in ipairs(camion:GetDescendants()) do
        if descendant:IsA("TextLabel") or descendant:IsA("TextBox") or descendant:IsA("TextButton") then
            if descendant.Name == "Texto" or descendant.Name == "TextLabel" then
                cartelesEncontrados = cartelesEncontrados + 1
                local nombreOrigenLimpio = string.gsub(origen, "_", " ")
                descendant.Text = string.format("SUMINISTROS\n%s\nDE: %s", tipo:upper(), nombreOrigenLimpio)
            end
        end
    end
    
    if cartelesEncontrados == 0 then
        warn("[SUMINISTROS] No se encontro ninguna etiqueta de texto ('Texto' o 'TextLabel') en el camion")
    end

    pcall(function()
        local chatEvent = game:GetService("ReplicatedStorage"):FindFirstChild("SuministrosChatEvent")
        if chatEvent then
            local nombreOrigenLimpio = string.gsub(origen, "_", " ")
            chatEvent:FireAllClients(
                string.format("[LOGISTICA] Convoy de '%s' llego con %s", nombreOrigenLimpio, tipo:upper()),
                COLORES[tipo] or Color3.fromRGB(50, 200, 100)
            )
        end
    end)

    local vectorAvance
    if EJE_MOVIMIENTO == "RightVector" then
        vectorAvance = spawnCFrame.RightVector
    elseif EJE_MOVIMIENTO == "-RightVector" then
        vectorAvance = -spawnCFrame.RightVector
    elseif EJE_MOVIMIENTO == "LookVector" then
        vectorAvance = spawnCFrame.LookVector
    elseif EJE_MOVIMIENTO == "-LookVector" then
        vectorAvance = -spawnCFrame.LookVector
    else
        vectorAvance = spawnCFrame.LookVector
    end

    local targetCFrame = spawnCFrame + (vectorAvance * DISTANCIA_AVANCE)
    
    local cframeValue = Instance.new("CFrameValue")
    cframeValue.Value = spawnCFrame
    local connection = cframeValue.Changed:Connect(function(nuevoCFrame)
        camion:PivotTo(nuevoCFrame)
    end)

    local duracionViaje = DISTANCIA_AVANCE / VELOCIDAD
    local tweenInfoViaje = TweenInfo.new(duracionViaje, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
    local tweenEntrada = TweenService:Create(cframeValue, tweenInfoViaje, {Value = targetCFrame})
    tweenEntrada:Play()
    tweenEntrada.Completed:Wait()

    task.wait(TIEMPO_DESTINO)

    local giraCFrame = targetCFrame * CFrame.Angles(0, math.rad(180), 0)
    local tweenInfoGiro = TweenInfo.new(2, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut)
    local tweenGiro = TweenService:Create(cframeValue, tweenInfoGiro, {Value = giraCFrame})
    tweenGiro:Play()
    tweenGiro.Completed:Wait()

    local retornoCFrame = spawnCFrame * CFrame.Angles(0, math.rad(180), 0)
    local tweenSalida = TweenService:Create(cframeValue, tweenInfoViaje, {Value = retornoCFrame})
    tweenSalida:Play()
    tweenSalida.Completed:Wait()

    connection:Disconnect()
    cframeValue:Destroy()
    camion:Destroy()
end

local function verificarNuevosEventos()
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

        task.spawn(animarCamion, evento.tipo_suministro, evento.ejercito_origen, EJERCITO_ID)
    end
end

local function inicializarChatSeguro()
    local ReplicatedStorage = game:GetService("ReplicatedStorage")
    local chatEvent = ReplicatedStorage:FindFirstChild("SuministrosChatEvent")
    if not chatEvent then
        chatEvent = Instance.new("RemoteEvent")
        chatEvent.Name = "SuministrosChatEvent"
        chatEvent.Parent = ReplicatedStorage
    end

    local StarterPlayer = game:GetService("StarterPlayer")
    local clientScript = StarterPlayer.StarterPlayerScripts:FindFirstChild("SuministrosClient")
    if not clientScript then
        clientScript = Instance.new("LocalScript")
        clientScript.Name = "SuministrosClient"
        clientScript.Source = [[
            local ReplicatedStorage = game:GetService("ReplicatedStorage")
            local StarterGui = game:GetService("StarterGui")
            local chatEvent = ReplicatedStorage:WaitForChild("SuministrosChatEvent")

            chatEvent.OnClientEvent:Connect(function(text, color)
                pcall(function()
                    StarterGui:SetCore("ChatMakeSystemMessage", {
                        Text = text,
                        Color = color,
                        Font = Enum.Font.GothamBold,
                        FontSize = Enum.FontSize.Size18,
                    })
                end)
            end)
        ]]
        clientScript.Parent = StarterPlayer.StarterPlayerScripts
    end
end

local function inicializar()
    pcall(inicializarChatSeguro)

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

    while true do
        task.wait(INTERVALO_POLLING)
        verificarNuevosEventos()
    end
end

inicializar()
