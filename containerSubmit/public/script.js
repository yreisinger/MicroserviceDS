window.onload = () => {
    loadTypes()
}

async function loadTypes()    {
    let select = document.getElementById('select')

    await fetch('/types')
        .then(response => response.json())
        .then(data => {
            console.log(data)

            select.innerHTML = '';

            data.forEach(type => {
                select.innerHTML += `<option value=${type.id}>${type.name}</option>`
            })
        })
        .catch(err => console.error(err))
}

async function submitJoke(type, text, punchline) {
    joke = {
        id : 0,
        type_id: type,
        text: text,
        punchline : punchline
    }

    await fetch('/sub', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
        body: JSON.stringify({joke: joke})
    })
        .then(response => response.json())
        .then(data => console.log(data))
        .catch(err => console.error(err))
}