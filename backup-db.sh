#!/bin/bash

# Script de respaldo de base de datos
# Uso: ./backup-db.sh

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Iniciando respaldo de base de datos...${NC}"

# Crear carpeta de backups si no existe
BACKUP_DIR="server/data/backups"
mkdir -p "$BACKUP_DIR"

# Verificar si existe la base de datos
DB_FILE="server/data/db.sqlite"

if [ ! -f "$DB_FILE" ]; then
    echo -e "${RED}❌ Error: No se encontró la base de datos en $DB_FILE${NC}"
    exit 1
fi

# Crear nombre de archivo con timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sqlite"

# Copiar base de datos
cp "$DB_FILE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    # Obtener tamaño del archivo
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup creado exitosamente${NC}"
    echo -e "   📁 Archivo: ${BACKUP_FILE}"
    echo -e "   📊 Tamaño: ${SIZE}"
    
    # Contar backups existentes
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.sqlite 2>/dev/null | wc -l)
    echo -e "   💾 Total de backups: ${BACKUP_COUNT}"
    
    # Limpiar backups antiguos (mantener solo los últimos 10)
    if [ $BACKUP_COUNT -gt 10 ]; then
        echo -e "${YELLOW}🧹 Limpiando backups antiguos...${NC}"
        ls -t "$BACKUP_DIR"/*.sqlite | tail -n +11 | xargs rm -f
        echo -e "${GREEN}✅ Backups antiguos eliminados${NC}"
    fi
else
    echo -e "${RED}❌ Error al crear backup${NC}"
    exit 1
fi

echo -e "${GREEN}✨ Proceso completado${NC}"