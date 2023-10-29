const express = require('express');
const NodeCache = require('node-cache');
const { Client } = require('@notionhq/client');

const app = express();
const PORT = process.env.PORT || 3000;
const myCache = new NodeCache();  // Inicializar el caché


// Inicializar el cliente de Notion
const notion = new Client({
    auth: 'secret_BR7pIAhSbjpZOhqUoiMuvN2HTo88C0bFObP5m7wWf0Q'
});

app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.get('/menu', async (req, res) => {
    const cacheKey = "menuItems";
    const cachedData = myCache.get(cacheKey);

    if (cachedData) {
        return res.json(cachedData);
    }

    try {
        const response = await notion.databases.query({
            database_id: '11e2573297e14a4991ec520450c0a032'
        });
        
        // Ordenar los elementos según la categoría
        const order = ["Postres", "Tragos", "Platos"];
        const sortedItems = response.results.sort((a, b) => {
            const aValue = a.properties.categoria && a.properties.categoria.select ? a.properties.categoria.select.name : "";
            const bValue = b.properties.categoria && b.properties.categoria.select ? b.properties.categoria.select.name : "";
            return order.indexOf(aValue) - order.indexOf(bValue);
        });

        // Agrupar los elementos ordenados por tipo
        const groupedAndSorted = {};
        for (const item of sortedItems) {
            const type = item.type;  // Suponiendo que "type" es un campo en tu base de datos
            if (!groupedAndSorted[type]) {
                groupedAndSorted[type] = [];
            }
            groupedAndSorted[type].push(item);
        }

        myCache.set(cacheKey, groupedAndSorted);  // Guardar en caché
        res.json(groupedAndSorted);  // Enviar la respuesta

    } catch (error) {
        console.error("Error fetching data from Notion:", error);
        res.status(500).json({ error: 'Error fetching data from Notion' });
    }
});


app.post('/update-item', express.json(), async (req, res) => {
const { itemId, name, price, imageUrl, description } = req.body;
const properties = {
    'nombre': {
        'title': [{ 'text': { 'content': name } }]
    },
    'precio': {
        'number': price
    },
    'descripcion': {
        'rich_text': [{ 'text': { 'content': description } }]
    }
};

if (imageUrl) {
    properties['url-imagen'] = { 'url': imageUrl };
}

try {
    await notion.pages.update({
        page_id: itemId,
        properties: properties
    });
    res.json({ success: true });
} catch (error) {
    console.error("Error updating item in Notion:", error);
    res.status(500).json({ error: 'Error updating item in Notion' });
}
myCache.del("menuItems");  // Invalidar el caché

});


let cachedMenuItems = null;  // Caché en variable


app.post('/add-item', express.json(), async (req, res) => {
const { name, price, imageUrl, description, category } = req.body;
const properties = {
    'nombre': {
        'title': [{ 'text': { 'content': name } }]
    },
    'precio': {
        'number': price
    },
    'descripcion': {
        'rich_text': [{ 'text': { 'content': description } }]
    },
    'categoria': {
        'multi_select': [{ 'name': category }]  // Aquí cambiamos 'select' por 'multi_select'
    }
};

if (imageUrl !== null) {
    properties['url-imagen'] = { 'url': imageUrl };
}
try {
    await notion.pages.create({
        parent: { database_id: '11e2573297e14a4991ec520450c0a032' },
        properties: properties
    });

    res.json({ success: true });
} catch (error) {
    console.error("Error adding new item:", error);
    res.status(500).json({ error: 'Error adding new item' });
}
});

app.delete('/delete-item/:itemId', async (req, res) => {
const { itemId } = req.params;
try {
    await notion.pages.update({
        page_id: itemId,
        archived: true  // Archivar la página en lugar de eliminarla
    });
    res.json({ success: true });
} catch (error) {
    console.error("Error deleting item in Notion:", error);
    res.status(500).json({ error: 'Error deleting item in Notion' });
}
myCache.del("menuItems");  // Invalidar el caché
res.json({ success: true });
});
