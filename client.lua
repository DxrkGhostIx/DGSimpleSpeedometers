local customBicycles = {
    -- Custom-Fahrräder hier eintragen, falls sie von IsThisModelABicycle nicht erkannt werden:
    -- [`bmxcustom`] = true,
}

local editMode = false

local function isRealBicycle(vehicle)
    if vehicle == 0 or not DoesEntityExist(vehicle) then
        return false
    end

    local model = GetEntityModel(vehicle)

    if IsThisModelABicycle(model) then
        return true
    end

    -- Fallback: GTA-Fahrzeugklasse 13 = Cycles/Fahrräder
    if GetVehicleClass(vehicle) == 13 then
        return true
    end

    return customBicycles[model] == true
end

local function setSpeedometerEditMode(enabled)
    editMode = enabled == true
    SetNuiFocus(editMode, editMode)
    SetNuiFocusKeepInput(editMode)

    SendNUIMessage({
        action = 'setEditMode',
        enabled = editMode
    })
end

RegisterCommand('editspeedometer', function()
    setSpeedometerEditMode(not editMode)
end, false)

RegisterCommand('resetspeedometer', function()
    SendNUIMessage({ action = 'resetSpeedometerSettings' })
end, false)

RegisterNUICallback('closeSpeedometerEditor', function(_, cb)
    setSpeedometerEditMode(false)
    cb({ ok = true })
end)

CreateThread(function()
    SendNUIMessage({ action = 'hideAll' })

    while true do
        local waitTime = 500

        if editMode then
            waitTime = 250
        else
            local ped = PlayerPedId()

            if IsPedInAnyVehicle(ped, false) then
                local veh = GetVehiclePedIsIn(ped, false)

                if isRealBicycle(veh) then
                    waitTime = 100

                    SendNUIMessage({
                        action = 'showBike',
                        speed = GetEntitySpeed(veh) * 3.6,
                        temp = 26.0
                    })
                else
                    waitTime = 100

                    SendNUIMessage({
                        action = 'showVehicle',
                        speed = math.floor(GetEntitySpeed(veh) * 3.6),
                        fuel = GetVehicleFuelLevel(veh)
                    })
                end
            else
                SendNUIMessage({ action = 'hideAll' })
            end
        end

        Wait(waitTime)
    end
end)
