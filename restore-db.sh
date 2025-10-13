#!/bin/bash

# Script de restauración de base de datos
# Uso: ./restore-db.sh [numero_de_backup]

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKUP_DIR="server/data/backups"
DB_FILE="server/data/db.sqlite"

echo -e "${BLUE}🔄 Script de Restauración de Base de Datos${NC}"
echo ""

# Verificar si hay backups
if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR/*.sqlite 2>/dev/null)" ]; then
    echo -e "${RED}❌ No se encontraron backups en $BACKUP_DIR${NC}"
    exit 1
fi

# Listar backups disponibles
echo -e "${YELLOW}📋 Backups disponibles:${NC}"
echo ""

BACKUPS=($(ls -t "$BACKUP_DIR"/*.sqlite))
COUNT=1

for backup in "${BACKUPS[@]}"; do
    FILENAME=$(basename "$backup")
    SIZE=$(du -h "$backup" | cut -f1)
    DATE=$(echo "$FILENAME" | grep -oP '\d{8}_\d{6}')
    FORMATTED_DATE=$(date -d "${DATE:0:8} ${DATE:9:2}:${DATE:11:2}:${DATE:13:2}" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$DATE")
    
    echo -e "  ${GREEN}${COUNT})${NC} ${FILENAME}"
    echo -e "     📅 Fecha: ${FORMATTED_DATE}"
    echo -e "     📊 Tamaño: ${SIZE}"
    echo ""
    COUNT=$((COUNT + 1))
done

# Seleccionar backup
if [ -z "$1" ]; then
    echo -n -e "${YELLOW}Selecciona el número de backup a restaurar (1-$((COUNT-1))): ${NC}"
    read SELECTION
else
    SELECTION=$1
fi

# Validar selección
if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -lt 1 ] || [ "$SELECTION" -ge "$COUNT" ]; then
    echo -e "${RED}❌ Selección inválida${NC}"
    exit 1
fi

# Obtener archivo seleccionado
SELECTED_BACKUP="${BACKUPS[$((SELECTION-1))]}"
echo ""
echo -e "${YELLOW}⚠️  ADVERTENCIA: Esto sobrescribirá la base de datos actual${NC}"
echo -e "${YELLOW}   Archivo a restaurar: $(basename "$SELECTED_BACKUP")${NC}"
echo ""
echo -n -e "${YELLOW}¿Estás seguro? (s/n): ${NC}"
read CONFIRM

if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
    echo -e "${RED}❌ Restauración cancelada${NC}"
    exit 0
fi

# Hacer backup de la DB actual si existe
if [ -f "$DB_FILE" ]; then
    CURRENT_BACKUP="${BACKUP_DIR}/db_before_restore_$(date +%Y%m%d_%H%M%S).sqlite"
    cp "$DB_FILE" "$CURRENT_BACKUP"
    echo -e "${GREEN}✅ Base de datos actual respaldada en:${NC}"
    echo -e "   $CURRENT_BACKUP"
fi

# Restaurar backup
cp "$SELECTED_BACKUP" "$DB_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Base de datos restaurada exitosamente${NC}"
    echo -e "   📁 Desde: $(basename "$SELECTED_BACKUP")"
    echo -e "   📍 Hacia: $DB_FILE"
    echo ""
    echo -e "${GREEN}✨ Proceso completado${NC}"
else
    echo -e "${RED}❌ Error al restaurar la base de datos${NC}"
    exit 1
fi